import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://umbavqavbopqajpvlpta.supabase.co';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_YvN_P3YptuAKice53SgVpg_6PFYq2C0';

// Check if localStorage is available (often blocked in iOS iframes)
const isLocalStorageAvailable = () => {
  try {
    const test = '__storage_test__';
    window.localStorage.setItem(test, test);
    window.localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
};

let supabase: any;

try {
  console.log('Supabase: Initializing client...');
  const options: any = {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  };

  // If localStorage is blocked, use a no-op storage or memory storage
  if (!isLocalStorageAvailable()) {
    console.warn('Supabase: localStorage is not available. Auth persistence will be disabled.');
    options.auth.persistSession = false;
  }

  supabase = createClient(supabaseUrl, supabaseAnonKey, options);

  // Wrap from() to automatically track write operations per device session
  const originalFrom = supabase.from;
  supabase.from = function (table: string) {
    const builder = originalFrom.call(supabase, table);
    
    const originalInsert = builder.insert;
    builder.insert = function (...args: any[]) {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('capitae_last_write', Date.now().toString());
        sessionStorage.setItem(`capitae_last_write_${table}`, Date.now().toString());
      }
      return originalInsert.apply(this, args);
    };

    const originalUpdate = builder.update;
    builder.update = function (...args: any[]) {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('capitae_last_write', Date.now().toString());
        sessionStorage.setItem(`capitae_last_write_${table}`, Date.now().toString());
      }
      return originalUpdate.apply(this, args);
    };

    const originalDelete = builder.delete;
    builder.delete = function (...args: any[]) {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('capitae_last_write', Date.now().toString());
        sessionStorage.setItem(`capitae_last_write_${table}`, Date.now().toString());
      }
      return originalDelete.apply(this, args);
    };

    const originalUpsert = builder.upsert;
    builder.upsert = function (...args: any[]) {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('capitae_last_write', Date.now().toString());
        sessionStorage.setItem(`capitae_last_write_${table}`, Date.now().toString());
      }
      return originalUpsert.apply(this, args);
    };

    return builder;
  };

  console.log('Supabase: Client initialized successfully');
} catch (err) {
  console.error('Supabase: Client creation failed:', err);
  // Fallback mock to prevent app crash
  supabase = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: () => Promise.reject(new Error('Supabase not initialized')),
      signUp: () => Promise.reject(new Error('Supabase not initialized')),
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => ({
      select: () => ({ 
        order: () => ({ 
          on: () => ({
            single: () => Promise.reject(new Error('Supabase not initialized')),
          }),
          single: () => Promise.reject(new Error('Supabase not initialized')),
        }),
        eq: () => ({
          single: () => Promise.reject(new Error('Supabase not initialized')),
          order: () => Promise.reject(new Error('Supabase not initialized')),
        }),
        single: () => Promise.reject(new Error('Supabase not initialized')),
      }),
      insert: () => Promise.reject(new Error('Supabase not initialized')),
      update: () => Promise.reject(new Error('Supabase not initialized')),
      delete: () => Promise.reject(new Error('Supabase not initialized')),
      upsert: () => Promise.reject(new Error('Supabase not initialized')),
    }),
    channel: () => ({
      on: () => ({
        subscribe: (cb: any) => {
          if (cb) cb('CHANNEL_ERROR');
          return { unsubscribe: () => Promise.resolve() };
        }
      }),
      subscribe: (cb: any) => {
        if (cb) cb('CHANNEL_ERROR');
        return { unsubscribe: () => Promise.resolve() };
      }
    }),
    removeChannel: () => Promise.resolve(),
    removeAllChannels: () => Promise.resolve(),
  };
}

// Singleton promise to prevent concurrent auth requests
let currentUserPromise: Promise<any> | null = null;

// Helper to get user safely and handle refresh token errors
export const getSafeUser = async (retryCount = 0): Promise<any> => {
  // If there's an active request, wait for it
  if (currentUserPromise) {
    try {
      return await currentUserPromise;
    } catch (e) {
      // If the promise failed, we'll try again below
      currentUserPromise = null;
    }
  }

  currentUserPromise = (async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      
      if (error) {
        const errorMsg = error.message || '';
        
        // Handle lock errors by retrying
        const isLockError = 
          errorMsg.includes('lock') || 
          errorMsg.includes('stole it') || 
          errorMsg.includes('broken by another request');

        if (isLockError && retryCount < 3) {
          console.warn(`Supabase: Auth lock error detected, retrying (${retryCount + 1}/3)...`);
          currentUserPromise = null; // Clear promise so retry can start fresh
          await new Promise(resolve => setTimeout(resolve, 200 * (retryCount + 1)));
          return getSafeUser(retryCount + 1);
        }

        // Check if this is a transient network or offline error to prevent accidental sign outs
        const isNetworkOrOffline = (() => {
          if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
          const low = errorMsg.toLowerCase();
          return (
            low.includes('fetch') ||
            low.includes('network') ||
            low.includes('connection') ||
            low.includes('timeout') ||
            low.includes('load failed') ||
            low.includes('failed to fetch') ||
            low.includes('offline')
          );
        })();

        // If refresh token is invalid, clear session and reload
        const isRefreshTokenError = !isNetworkOrOffline && (
          errorMsg.includes('Refresh Token') || 
          errorMsg.includes('refresh_token') ||
          errorMsg.includes('refresh_token_not_found') ||
          ((error as any).status === 400 && errorMsg.includes('invalid_grant'))
        );

        if (isRefreshTokenError) {
          console.error('Supabase: Invalid refresh token detected in getSafeUser, force clearing session...');
          
          // First, proactively clear storage so the corrupted session is gone immediately
          if (typeof window !== 'undefined' && window.localStorage) {
            Object.keys(window.localStorage).forEach(key => {
              if (key.startsWith('sb-')) window.localStorage.removeItem(key);
            });
          }

          try {
            // Try standard sign out
            await supabase.auth.signOut();
          } catch (e) {
            console.warn('Supabase: Standard signOut failed (expected on invalid tokens), backup clear of storage is already complete.');
          }
          
          // Use a small delay before reload to ensure redirect/reload is fully ready
          setTimeout(() => {
            if (typeof window !== 'undefined') window.location.reload();
          }, 150);
          return null;
        }

        console.error('Supabase: getSafeUser error:', error);
        return null;
      }
      return data?.user || null;
    } catch (err: any) {
      const errMessage = err?.message || String(err);
      const isLockError = 
        errMessage.includes('lock') || 
        errMessage.includes('stole it') || 
        errMessage.includes('broken by another request');

      if (isLockError && retryCount < 3) {
        console.warn(`Supabase: Auth lock error caught, retrying (${retryCount + 1}/3)...`);
        currentUserPromise = null;
        await new Promise(resolve => setTimeout(resolve, 200 * (retryCount + 1)));
        return getSafeUser(retryCount + 1);
      }

      console.error('getSafeUser error:', err);
      return null;
    } finally {
      // Clear the promise after a short delay to allow subsequent calls to hit the cache
      // but prevent immediate re-fetching if many calls happen in the same tick
      setTimeout(() => {
        currentUserPromise = null;
      }, 500);
    }
  })();

  return currentUserPromise;
};

export { supabase };
