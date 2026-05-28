import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  X, 
  Check, 
  Trash2, 
  Settings, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  HelpCircle,
  Eye,
  Volume2,
  VolumeX,
  Sparkles,
  Info,
  Database,
  Radio,
  Copy
} from 'lucide-react';
import { 
  AppNotification, 
  getNotifications, 
  markAsRead, 
  markAllNotificationsAsRead, 
  deleteNotification, 
  clearAllNotifications, 
  getNotificationSettings, 
  saveNotificationSettings,
  requestNativePermission,
  NotificationSettings
} from '../utils/notifications';

interface NotificationCenterProps {
  userId: string;
  onRedirectToTab: (tab: 'home' | 'bills' | 'reports' | 'gamification' | 'forecast' | 'profile') => void;
}

export default function NotificationCenter({ userId, onRedirectToTab }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>(() => getNotificationSettings(userId));
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [nativePermStatus, setNativePermStatus] = useState<string>('default');
  const [copiedSql, setCopiedSql] = useState(false);
  const [rtStatus, setRtStatus] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined' && (window as any).__capitae_realtime_status) {
      return (window as any).__capitae_realtime_status;
    }
    return {
      gastos: 'conectando',
      caixinhas: 'conectando',
      bills: 'conectando',
      profiles: 'conectando',
      daily_missions: 'conectando',
      user_notifications: 'conectando'
    };
  });

  // Listen to realtime connection updates
  useEffect(() => {
    const handleStatusUpdate = () => {
      if (typeof window !== 'undefined' && (window as any).__capitae_realtime_status) {
        setRtStatus({ ...(window as any).__capitae_realtime_status });
      }
    };
    window.addEventListener('capitae_rt_status', handleStatusUpdate);
    return () => {
      window.removeEventListener('capitae_rt_status', handleStatusUpdate);
    };
  }, []);

  // Load notifications and settings
  const loadNotifData = () => {
    setNotifications(getNotifications(userId));
    const currentSettings = getNotificationSettings(userId);
    setSettings(currentSettings);
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const isIframe = window.self !== window.top;
      if (isIframe) {
        setNativePermStatus(currentSettings.enableNative ? 'granted' : 'default');
      } else {
        setNativePermStatus(Notification.permission);
      }
    }
  };

  useEffect(() => {
    loadNotifData();

    // Listen to custom notification update events
    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.userId === userId) {
        setNotifications(getNotifications(userId));
      }
    };

    window.addEventListener('capitae_notifications_update', handleUpdate);
    return () => {
      window.removeEventListener('capitae_notifications_update', handleUpdate);
    };
  }, [userId]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleToggleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      loadNotifData();
      setShowSettings(false);
    }
  };

  const handleMarkAsRead = (id: string, metadata?: any) => {
    markAsRead(userId, id);
    if (metadata?.billId) {
      sessionStorage.setItem('capitae_selected_bill_id', metadata.billId);
      sessionStorage.setItem('capitae_selected_bill_type', metadata.billType || 'pagar');
      onRedirectToTab('bills');
      setIsOpen(false);
    }
  };

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead(userId);
  };

  const handleClearAll = () => {
    if (window.confirm('Deseja realmente limpar todas as notificações?')) {
      clearAllNotifications(userId);
    }
  };

  const handleToggleNative = async () => {
    if (!settings) return;
    
    if (!settings.enableNative) {
      const isIframe = typeof window !== 'undefined' && window.self !== window.top;
      const granted = isIframe ? true : await requestNativePermission();
      setNativePermStatus(granted ? 'granted' : 'denied');
      const updated = { ...settings, enableNative: granted };
      setSettings(updated);
      saveNotificationSettings(userId, updated);
    } else {
      const updated = { ...settings, enableNative: false };
      setSettings(updated);
      if (typeof window !== 'undefined' && window.self !== window.top) {
        setNativePermStatus('default');
      } else {
        setNativePermStatus(Notification.permission);
      }
      saveNotificationSettings(userId, updated);
    }
  };

  const handleToggleType = (type: keyof NotificationSettings['enabledTypes']) => {
    if (!settings) return;
    const updated = {
      ...settings,
      enabledTypes: {
        ...settings.enabledTypes,
        [type]: !settings.enabledTypes[type]
      }
    };
    setSettings(updated);
    saveNotificationSettings(userId, updated);
  };

  const handleUpdateLimit = (val: string) => {
    if (!settings) return;
    const num = val === '' ? null : parseFloat(val);
    const updated = {
      ...settings,
      customLimit: num
    };
    setSettings(updated);
    saveNotificationSettings(userId, updated);
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'unread') return !n.read;
    return true;
  });

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'due_date':
        return <Calendar className="w-4 h-4 text-primary" />;
      case 'limit_alert':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'insert_confirm':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'weekly_summary':
        return <TrendingUp className="w-4 h-4 text-primary" />;
      case 'reengagement':
        return <Sparkles className="w-4 h-4 text-yellow-500" />;
      default:
        return <Bell className="w-4 h-4 text-muted" />;
    }
  };

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button 
        onClick={handleToggleOpen}
        className="p-2 hover:bg-foreground/5 rounded-xl transition-colors relative text-muted hover:text-foreground group"
        title="Notificações"
      >
        <Bell className="w-5 h-5 group-hover:scale-105 transition-transform" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary text-background text-[10px] font-black rounded-full flex items-center justify-center animate-bounce shadow-md">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Floating Center Drawer */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[90]"
              />

              {/* Custom Drawer */}
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 180 }}
                className="fixed inset-y-0 right-0 h-full h-[100dvh] max-h-screen w-full max-w-md bg-secondary border-l border-foreground/5 z-[100] flex flex-col shadow-2xl overflow-hidden"
              >
                {/* Header */}
                <div className="pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-6 px-6 border-b border-foreground/5 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg tracking-tight">Painel de Notificações</h3>
                      <p className="text-[10px] text-muted font-bold uppercase tracking-wider">Mantenha seu controle em dia</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setShowSettings(!showSettings)}
                      className={`p-2 rounded-xl transition-all ${showSettings ? 'bg-primary text-background scale-105' : 'hover:bg-foreground/5 text-muted hover:text-foreground'}`}
                      title="Ajustes de Notificação"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setIsOpen(false)} 
                      className="p-2 hover:bg-foreground/5 rounded-xl text-muted hover:text-foreground transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Sub-Header Actions */}
                {!showSettings && notifications.length > 0 && (
                  <div className="px-6 py-3 bg-background/30 border-b border-foreground/5 flex items-center justify-between text-xs shrink-0">
                    <div className="flex gap-1">
                      <button 
                        onClick={() => setActiveTab('all')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all ${activeTab === 'all' ? 'bg-foreground/5 text-foreground' : 'text-muted hover:text-foreground'}`}
                      >
                        Todas ({notifications.length})
                      </button>
                      <button 
                        onClick={() => setActiveTab('unread')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all ${activeTab === 'unread' ? 'bg-foreground/5 text-foreground' : 'text-muted hover:text-foreground'}`}
                      >
                        Não Lidas ({unreadCount})
                      </button>
                    </div>
                    <div className="flex gap-3 text-[10px] font-bold uppercase tracking-wider">
                      {unreadCount > 0 && (
                        <button onClick={handleMarkAllRead} className="text-primary hover:opacity-80 transition-opacity">
                          Marcar Unidas
                        </button>
                      )}
                      <button onClick={handleClearAll} className="text-red-500 hover:opacity-80 transition-opacity">
                        Limpar Tudo
                      </button>
                    </div>
                  </div>
                )}

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
                  {showSettings ? (
                    /* Settings Panel */
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <h4 className="font-bold text-sm tracking-tight text-foreground">Notificações do Sistema (Push)</h4>
                        <p className="text-[11px] text-muted leading-relaxed">
                          Receba avisos instantâneos de vencimentos e limites diretamente no seu navegador, mesmo com o app em segundo plano.
                        </p>
                        
                        <button 
                          onClick={handleToggleNative}
                          className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all text-left ${settings?.enableNative ? 'bg-primary/5 border-primary text-primary' : 'bg-background border-foreground/5 text-muted'}`}
                        >
                          <div className="flex items-center gap-3">
                            {settings?.enableNative ? <Volume2 className="w-5 h-5 text-primary" /> : <VolumeX className="w-5 h-5 text-muted" />}
                            <div>
                              <p className="text-xs font-bold text-foreground">
                                {settings?.enableNative ? 'Notificações Push Ativas' : 'Permitir no Navegador'}
                              </p>
                              <p className="text-[10px] text-muted mt-0.5">
                                {nativePermStatus === 'denied' ? 'Acesso bloqueado pelo navegador' : '100% gratuito e local'}
                              </p>
                            </div>
                          </div>
                          <div className={`w-8 h-4 rounded-full transition-colors relative ${settings?.enableNative ? 'bg-primary' : 'bg-foreground/15'}`}>
                            <div className={`w-3.5 h-3.5 bg-secondary rounded-full absolute top-0.25 transition-all ${settings?.enableNative ? 'right-0.5' : 'left-0.5'}`} />
                          </div>
                        </button>

                        {nativePermStatus === 'denied' && !settings?.enableNative && (
                          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-[11px] text-red-500 space-y-2 mt-2 leading-relaxed">
                            <p className="font-bold flex items-center gap-1.5 text-xs">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              Notificações Bloqueadas no Navegador
                            </p>
                            <p className="font-semibold text-foreground/80">
                              Seus alertas não serão mostrados porque você bloqueou as permissões anteriormente. Para desbloquear e receber alertas 3 dias antes das contas vencerem:
                            </p>
                            <ul className="list-disc pl-4 space-y-1 mt-1.5 font-bold text-red-400">
                              <li>Procure o <strong>ícone de cadeado 🔒</strong> na barra de endereços (ao lado do link do site, no topo).</li>
                              <li>Toque/clique nele para abrir as permissões do site.</li>
                              <li>Ative/permita as <strong>Notificações</strong>.</li>
                              <li>Recarregue a página!</li>
                            </ul>
                          </div>
                        )}

                        {nativePermStatus === 'default' && !settings?.enableNative && (
                          <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl text-[11px] text-primary space-y-2 mt-2 leading-relaxed animate-pulse">
                            <p className="font-bold flex items-center gap-1.5 text-xs">
                              <Sparkles className="w-4 h-4 shrink-0" />
                              Ative para não Esquecer Contas!
                            </p>
                            <p className="font-semibold text-foreground/80">
                              Clique no botão "Permitir no Navegador" acima para aprovar a permissão do sistema. Você começará a receber alertas valiosos de suas despesas e limites automaticamente!
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4 pt-4 border-t border-foreground/5">
                        <h4 className="font-bold text-sm tracking-tight text-foreground">Controles por Tipo</h4>
                        
                        <div className="space-y-3">
                          {[
                            { key: 'due_date', label: '⏰ Contas a Vencer', desc: 'Alertas 3 dias antes, 1 dia antes e no vencimento' },
                            { key: 'limit_alert', label: '🚨 Limite de Gastos', desc: 'Avisos quando os custos do mês passam do teto' },
                            { key: 'insert_confirm', label: '💸 Confirmação de Serviços', desc: 'Resumos ao salvar despesas ou entradas' },
                            { key: 'weekly_summary', label: '📊 Resumos Semanais de Segunda', desc: 'Resumo com entradas, saídas e saldo' },
                          ].map(item => (
                            <div key={item.key} className="flex justify-between items-center bg-background/50 p-3 rounded-2xl border border-foreground/5">
                              <div>
                                <p className="text-xs font-bold text-foreground">{item.label}</p>
                                <p className="text-[10px] text-muted mt-0.5">{item.desc}</p>
                              </div>
                              <button
                                onClick={() => handleToggleType(item.key as any)}
                                className={`w-10 h-5 rounded-full transition-colors relative ${settings?.enabledTypes[item.key as keyof NotificationSettings['enabledTypes']] ? 'bg-primary' : 'bg-foreground/15'}`}
                              >
                                <div className={`w-4 h-4 bg-secondary rounded-full absolute top-0.5 transition-all ${settings?.enabledTypes[item.key as keyof NotificationSettings['enabledTypes']] ? 'right-0.5' : 'left-0.5'}`} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3 pt-4 border-t border-foreground/5">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm tracking-tight text-foreground">Teto Personalizado de Gastos</h4>
                          <span className="px-2 py-0.5 bg-foreground/5 text-muted text-[9px] font-black uppercase rounded">Opcional</span>
                        </div>
                        <p className="text-[11px] text-muted leading-relaxed">
                          Defina um limite de gastos absoluto mensal. Se deixado vazio, calcularemos automaticamente baseando-se no que foi planejado na sua Organização Salarial.
                        </p>
                        
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">R$</span>
                          <input 
                            type="number" 
                            placeholder="Ex: 1500"
                            value={settings?.customLimit === null ? '' : (settings?.customLimit ?? '')}
                            onChange={(e) => handleUpdateLimit(e.target.value)}
                            className="w-full bg-background border border-foreground/5 p-4 pl-10 rounded-2xl outline-none focus:border-primary transition-all text-sm font-bold"
                          />
                        </div>
                        <p className="text-[9px] text-primary/60 font-medium flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 shrink-0" />
                          {settings?.customLimit === null 
                            ? 'Modo Inteligente Ativo: usando limite planejado de Organização Salarial.' 
                            : 'Limite fixo manual sobrepõe o teto do planejamento.'}
                        </p>
                      </div>

                      <div className="pt-4">
                        <button 
                          onClick={() => setShowSettings(false)}
                          className="w-full py-3 bg-primary text-background rounded-xl font-bold text-xs uppercase tracking-wider"
                        >
                          Pronto
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Notifications List */
                    <div className="space-y-3">
                      {filteredNotifications.length === 0 ? (
                        <div className="text-center py-16 space-y-4">
                          <div className="w-16 h-16 bg-foreground/5 rounded-3xl flex items-center justify-center mx-auto text-muted">
                            <Bell className="w-8 h-8 opacity-40 animate-pulse" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-foreground">Nada por aqui no momento</p>
                            <p className="text-[10px] text-muted">Sua conta está em ordem e não há avisos pendentes.</p>
                          </div>
                        </div>
                      ) : (
                        filteredNotifications.map(item => (
                          <motion.div
                            key={item.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-4 rounded-2xl border transition-all relative group flex items-start gap-4 cursor-pointer ${item.read ? 'bg-secondary/40 border-foreground/5' : 'bg-primary/5 border-primary/20 shadow-md'}`}
                            onClick={() => handleMarkAsRead(item.id, item.metadata)}
                          >
                            {/* Left Icon Badge */}
                            <div className={`p-2.5 rounded-xl shrink-0 ${item.read ? 'bg-foreground/5 text-muted' : 'bg-primary/10 text-primary'}`}>
                              {getIcon(item.type)}
                            </div>

                            {/* Content */}
                            <div className="space-y-1.5 flex-1 min-w-0 pr-6">
                              <div className="flex items-center gap-2">
                                <h5 className={`text-xs font-bold truncate ${item.read ? 'text-foreground/75' : 'text-foreground'}`}>
                                  {item.title}
                                </h5>
                                {!item.read && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 animate-ping" />
                                )}
                              </div>
                              <p className="text-[10px] text-muted leading-relaxed break-words">{item.message}</p>
                              
                              <div className="flex items-center gap-3.5 text-[9px] text-muted font-bold uppercase tracking-wider pt-1">
                                <span>
                                  {new Date(item.timestamp).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {item.metadata?.billId && (
                                  <span className="text-primary hover:underline">Ir para Contas e Detalhes</span>
                                )}
                              </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="absolute top-4 right-4 flex items-center gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                              {!item.read && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsRead(userId, item.id);
                                  }}
                                  className="p-1 hover:bg-primary/10 text-primary rounded-lg"
                                  title="Marcar como lida"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(userId, item.id);
                                }}
                                className="p-1 hover:bg-red-500/10 text-red-500 rounded-lg"
                                title="Excluir notificação"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
