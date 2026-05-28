import { supabase } from '../lib/supabase';

export interface AppNotification {
  id: string;
  userId: string;
  type: 'due_date' | 'limit_alert' | 'insert_confirm' | 'weekly_summary' | 'reengagement';
  title: string;
  message: string;
  timestamp: string; // ISO String
  read: boolean;
  metadata?: {
    billId?: string;
    billType?: 'pagar' | 'receber';
    value?: number;
    category?: string;
    totalSpent?: number;
    totalReceived?: number;
    balance?: number;
  };
}

export interface NotificationSettings {
  enableNative: boolean;
  customLimit: number | null; // null means auto-calculate limit based on budget
  enabledTypes: {
    due_date: boolean;
    limit_alert: boolean;
    insert_confirm: boolean;
    weekly_summary: boolean;
    reengagement: boolean;
  };
}

const STORAGE_KEY_PREFIX = 'capitae_notifications_';
const SETTINGS_KEY_PREFIX = 'capitae_notif_settings_';
const LAST_OPEN_KEY_PREFIX = 'capitae_last_open_';

// Helper to get notifications for a user
export const getNotifications = (userId: string): AppNotification[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
};

// Helper to save notifications for a user
export const saveNotifications = (userId: string, notifications: AppNotification[]) => {
  if (typeof window === 'undefined') return;
  // Sort notifications: unread first, then by timestamp descending
  const sorted = [...notifications].sort((a, b) => {
    if (a.read && !b.read) return 1;
    if (!a.read && b.read) return -1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(sorted));
};

// Helper to get notification settings
export const getNotificationSettings = (userId: string): NotificationSettings => {
  const defaultSettings: NotificationSettings = {
    enableNative: true,
    customLimit: null,
    enabledTypes: {
      due_date: true,
      limit_alert: true,
      insert_confirm: true,
      weekly_summary: true,
      reengagement: true,
    }
  };
  if (typeof window === 'undefined') return defaultSettings;

  // Migration to force enableNative to true for existing users once
  const migrationKey = `capitae_notif_migration_v1_${userId}`;
  const hasMigrated = localStorage.getItem(migrationKey) === 'true';
  const stored = localStorage.getItem(`${SETTINGS_KEY_PREFIX}${userId}`);

  if (!hasMigrated) {
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        parsed.enableNative = true; // Auto-activate for existing users too!
        localStorage.setItem(`${SETTINGS_KEY_PREFIX}${userId}`, JSON.stringify(parsed));
      } catch (e) {}
    }
    localStorage.setItem(migrationKey, 'true');
  }

  if (!stored) return defaultSettings;
  try {
    const parsed = JSON.parse(stored);
    return {
      ...defaultSettings,
      ...parsed,
      enabledTypes: {
        ...defaultSettings.enabledTypes,
        ...(parsed.enabledTypes || {}),
        reengagement: true // Enforce reengagement is always enabled
      }
    };
  } catch (e) {
    return defaultSettings;
  }
};

// Helper to save notification settings
export const saveNotificationSettings = (userId: string, settings: NotificationSettings) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${SETTINGS_KEY_PREFIX}${userId}`, JSON.stringify(settings));
};

// Request Native Notification Permission
export const requestNativePermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
};

// Trigger Browser Native Notification
export const triggerNativeNotification = (title: string, body: string, userId: string) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  const settings = getNotificationSettings(userId);
  if (!settings.enableNative) return;

  if (Notification.permission === 'granted') {
    // Crucial for mobile / stand-alone PWA apps: use Service Worker showNotification so it registers on the OS level!
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          body,
          icon: '/icon.svg',      // PWA vector icon
          badge: '/icon.svg',     // Small status bar icon
          vibrate: [100, 50, 100], // Haptic vibration on android
          tag: 'capitae-notification', // Overwrite old if needed
          renotify: true
        } as any).catch((err) => {
          console.warn('SW failed to showNotification, falling back to standard Notification:', err);
          try {
            new Notification(title, {
              body,
              icon: '/icon.svg',
            });
          } catch (e2) {
            console.error('Fallback standard notification failed:', e2);
          }
        });
      }).catch((err) => {
        console.warn('SW registration not ready, falling back to standard Notification:', err);
        try {
          new Notification(title, {
            body,
            icon: '/icon.svg',
          });
        } catch (e2) {
          console.error('Fallback standard notification failed:', e2);
        }
      });
    } else {
      try {
        new Notification(title, {
          body,
          icon: '/icon.svg',
        });
      } catch (e) {
        console.error('Error triggering standard native notification:', e);
      }
    }
  }
};

// Add a notification with duplicate prevention
export const addNotification = (userId: string, notification: Omit<AppNotification, 'userId' | 'timestamp' | 'read'>) => {
  const notifications = getNotifications(userId);
  const settings = getNotificationSettings(userId);

  // Check if notification type is enabled in settings
  if (!settings.enabledTypes[notification.type]) return;

  // Check if identical ID already exists (duplicate check)
  if (notifications.some(n => n.id === notification.id)) {
    return;
  }

  const newNotif: AppNotification = {
    ...notification,
    userId,
    timestamp: new Date().toISOString(),
    read: false,
  };

  const updated = [newNotif, ...notifications];
  saveNotifications(userId, updated);

  // Sync to database
  try {
    supabase.from('user_notifications').insert([{
      id: newNotif.id,
      user_id: userId,
      type: newNotif.type,
      title: newNotif.title,
      message: newNotif.message,
      timestamp: newNotif.timestamp,
      read: newNotif.read,
      metadata: newNotif.metadata
    }]).then(({ error }: any) => {
      if (error) {
        console.warn('Notification sync write failed (table may not exist):', error.message);
      }
    });
  } catch (err) {
    console.warn('Notification sync write error:', err);
  }

  // Trigger system push-like notification
  triggerNativeNotification(notification.title, notification.message, userId);

  // Dispatch global custom event so UI can instantly update
  window.dispatchEvent(new CustomEvent('capitae_notifications_update', { detail: { userId } }));
};

// Mark individual notification as read
export const markAsRead = (userId: string, notificationId: string) => {
  const notifications = getNotifications(userId);
  const updated = notifications.map(n => n.id === notificationId ? { ...n, read: true } : n);
  saveNotifications(userId, updated);

  // Sync read status to database
  try {
    supabase.from('user_notifications').update({ read: true }).eq('id', notificationId).then(({ error }: any) => {
      if (error) console.warn('Notification sync read failed:', error.message);
    });
  } catch (err) {}

  window.dispatchEvent(new CustomEvent('capitae_notifications_update', { detail: { userId } }));
};

// Mark all as read
export const markAllNotificationsAsRead = (userId: string) => {
  const notifications = getNotifications(userId);
  const updated = notifications.map(n => ({ ...n, read: true }));
  saveNotifications(userId, updated);

  // Sync all read status for user in database
  try {
    supabase.from('user_notifications').update({ read: true }).eq('user_id', userId).then(({ error }: any) => {
      if (error) console.warn('Notification sync clear read fails:', error.message);
    });
  } catch (err) {}

  window.dispatchEvent(new CustomEvent('capitae_notifications_update', { detail: { userId } }));
};

// Delete notification
export const deleteNotification = (userId: string, notificationId: string) => {
  const notifications = getNotifications(userId);
  const updated = notifications.filter(n => n.id !== notificationId);
  saveNotifications(userId, updated);

  // Sync delete to database
  try {
    supabase.from('user_notifications').delete().eq('id', notificationId).then(({ error }: any) => {
      if (error) console.warn('Notification sync delete failed:', error.message);
    });
  } catch (err) {}

  window.dispatchEvent(new CustomEvent('capitae_notifications_update', { detail: { userId } }));
};

// Clear all notifications
export const clearAllNotifications = (userId: string) => {
  saveNotifications(userId, []);

  // Sync clear-all to database
  try {
    supabase.from('user_notifications').delete().eq('user_id', userId).then(({ error }: any) => {
      if (error) console.warn('Notification sync clear all failed:', error.message);
    });
  } catch (err) {}

  window.dispatchEvent(new CustomEvent('capitae_notifications_update', { detail: { userId } }));
};

// -------------------------------------------------------------
// TRIGGER DETECTOR SERVICES
// -------------------------------------------------------------

// 1. Due Dates: 3 days before, 1 day before, and on the due date.
export const checkDueBills = (userId: string, bills: any[]) => {
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const todayObj = new Date(todayStr);

  bills.forEach(bill => {
    // Only verify pending bills (status = 'pendente')
    if (bill.status !== 'pendente') return;

    const dueStr = bill.data_vencimento; // YYYY-MM-DD
    if (!dueStr) return;

    const dueObj = new Date(dueStr);
    const diffTime = dueObj.getTime() - todayObj.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const isReceivable = bill.tipo === 'receber';
    const typeLabel = isReceivable ? 'Recebível previsto' : 'Conta a vencer';
    const actionLabel = isReceivable ? 'receber' : 'pagar';
    const cleanDesc = bill.descricao.replace(/\s*\(Mensal Recorrente\)/i, '');

    // 3 Days before
    if (diffDays === 3) {
      const id = `due_${bill.id}_3days`;
      addNotification(userId, {
        id,
        type: 'due_date',
        title: `⏰ ${typeLabel} em 3 dias`,
        message: `Sua conta "${cleanDesc}" no valor de R$ ${bill.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} vence em 3 dias (${new Date(dueObj).toLocaleDateString('pt-BR')}).`,
        metadata: { billId: bill.id, billType: bill.tipo, value: bill.valor, category: bill.categoria }
      });
    }

    // 1 Day before
    if (diffDays === 1) {
      const id = `due_${bill.id}_1day`;
      addNotification(userId, {
        id,
        type: 'due_date',
        title: `⚠️ ${typeLabel} vence amanhã!`,
        message: `Atenção: "${cleanDesc}" de R$ ${bill.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} vence amanhã! Não se esqueça de gerenciar.`,
        metadata: { billId: bill.id, billType: bill.tipo, value: bill.valor, category: bill.categoria }
      });
    }

    // Today
    if (diffDays === 0) {
      const id = `due_${bill.id}_today`;
      addNotification(userId, {
        id,
        type: 'due_date',
        title: `🚨 ${typeLabel} vence HOJE!`,
        message: `Hoje é o dia de vencimento de "${cleanDesc}" de R$ ${bill.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Atualize seu status para manter seu saldo em dia.`,
        metadata: { billId: bill.id, billType: bill.tipo, value: bill.valor, category: bill.categoria }
      });
    }
  });
};

// 2. Budget limits alert
export const checkSpentLimit = (userId: string, spentThisMonth: number, monthlyIncome: number, profile: any) => {
  const settings = getNotificationSettings(userId);
  const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM

  // Determine limit
  let limit = settings.customLimit;
  let limitSource = 'definido por você';

  if (limit === null) {
    // Auto-calculate variable budget limit
    const fixedCosts = profile?.fixed_costs || 0;
    const netSalary = Math.max(0, monthlyIncome - fixedCosts);
    const percSpent = ((profile?.perc_essentials || 50) + (profile?.perc_leisure || 30)) / 100;
    limit = netSalary * percSpent;
    limitSource = 'planejado pela sua Organização Salarial';
  }

  if (limit <= 0) return;

  if (spentThisMonth > limit) {
    const id = `limit_alert_${userId}_${currentMonthStr}`;
    addNotification(userId, {
      id,
      type: 'limit_alert',
      title: '🚨 Limite de Gastos Excedido!',
      message: `Você ultrapassou o seu limite de gastos mensal de R$ ${limit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${limitSource}). Seus gastos atuais: R$ ${spentThisMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
      metadata: { totalSpent: spentThisMonth, value: limit }
    });
  }
};

// 3. Confirm operations instantly
export const addInsertConfirmNotification = (userId: string, type: 'gasto' | 'entrada', amount: number, category: string) => {
  const randomId = Math.random().toString(36).substring(2, 9);
  const id = `insert_${randomId}`;
  
  const isGasto = type === 'gasto';
  const title = isGasto ? '💸 Gasto Adicionado' : '💰 Entrada Adicionada';
  const message = isGasto 
    ? `Lançamento registrado: Gasto de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} na categoria "${category}".`
    : `Lançamento registrado: Entrada de R$ ${Math.abs(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} na categoria "${category}".`;

  addNotification(userId, {
    id,
    type: 'insert_confirm',
    title,
    message,
    metadata: { value: amount, category }
  });
};

// 4. Financial weekly summary (Every Monday)
export const checkWeeklySummary = (userId: string, expenses: any[], bills: any[]) => {
  const currentWeekYear = getWeekYearString(new Date()); // e.g. "2026-W21"
  const isMonday = new Date().getDay() === 1; // 1 is Monday
  
  if (!isMonday) return;

  const id = `weekly_summary_${userId}_${currentWeekYear}`;
  
  // Check if summary was already calculated for this week
  const notifications = getNotifications(userId);
  if (notifications.some(n => n.id === id)) return;

  // Let's analyze expenses and inputs of the past 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0,0,0,0);

  let totalSpent = 0;
  let totalReceived = 0;

  expenses.forEach(e => {
    const expenseDate = new Date(e.data);
    if (expenseDate >= sevenDaysAgo) {
      if (e.valor > 0) {
        totalSpent += e.valor;
      } else {
        totalReceived += Math.abs(e.valor);
      }
    }
  });

  const weeklyBalance = totalReceived - totalSpent;
  const emoji = weeklyBalance >= 0 ? '📈' : '📉';
  const statusPhrase = weeklyBalance >= 0 
    ? 'Parabéns, seu saldo foi positivo na última semana!' 
    : 'Atenção, seus gastos superaram suas receitas na última semana.';

  addNotification(userId, {
    id,
    type: 'weekly_summary',
    title: `${emoji} Resumo Financeiro Semanal`,
    message: `Veja seu resumo semanal: Recebido: R$ ${totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Gasto: R$ ${totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Saldo do período: R$ ${weeklyBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. ${statusPhrase}`,
    metadata: { totalSpent, totalReceived, balance: weeklyBalance }
  });
};

// 5. Reengagement Motivational Check on Login/Open
export const checkReengagement = (userId: string) => {
  if (typeof window === 'undefined') return;

  const key = `${LAST_OPEN_KEY_PREFIX}${userId}`;
  const now = Date.now();
  const lastOpenStr = localStorage.getItem(key);

  localStorage.setItem(key, now.toString());

  if (!lastOpenStr) return; // First time, just save current timestamp

  const lastOpenTime = parseInt(lastOpenStr, 10);
  const diffTime = now - lastOpenTime;
  const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;

  // If inactive for > 3 days
  if (diffTime > threeDaysInMs) {
    const daysInactive = Math.floor(diffTime / (24 * 60 * 60 * 1000));
    const randomId = Math.random().toString(36).substring(2, 9);
    const id = `reengage_${currentDateKey()}_${randomId}`;

    addNotification(userId, {
      id,
      type: 'reengagement',
      title: '🌟 Sentimos sua falta!',
      message: `Seus objetivos financeiros estão esperando por você. O Capitae está aqui para te ajudar a transformar sua realidade — não deixe para amanhã.`,
    });
  }
};

// Helper to get week number string
function getWeekYearString(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
}

// Helper to get simple date key
function currentDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
