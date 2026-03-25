// useSubscription.ts - Hook for native iOS StoreKit and Android Google Play Billing
// Uses expo-iap's useIAP hook with comprehensive logging and error handling
import { useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { useIAP } from 'expo-iap';
import type { Purchase, ProductSubscription } from 'expo-iap';
import { apiClient } from '../api/client';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Product IDs - MUST match EXACTLY what's in App Store Connect / Google Play Console
export const PRODUCT_IDS = {
  MONTHLY: 'com.matchsport24.subscription.monthly',
  YEARLY: 'com.matchsport24.subscription.yearly',
};

// Active SKUs to fetch (only monthly for now)
export const ACTIVE_SUBSCRIPTION_SKUS = [PRODUCT_IDS.MONTHLY];

// Timeouts
const FETCH_PRODUCTS_TIMEOUT = 15000; // 15 seconds
const CONNECTION_TIMEOUT = 10000; // 10 seconds

// ============================================================================
// LOGGING
// ============================================================================

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const log = (level: LogLevel, step: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const prefix = `[IAP][${level}][${step}]`;
  const logMessage = `${prefix} ${message}`;
  
  if (data !== undefined) {
    console.log(logMessage, JSON.stringify(data, null, 2));
  } else {
    console.log(logMessage);
  }
};

// ============================================================================
// TYPES
// ============================================================================

export type IAPState = 
  | 'initializing'      // Hook just mounted, waiting for connection
  | 'connecting'        // Actively connecting to store
  | 'connected'         // Connected but not yet fetched products
  | 'fetching'          // Fetching products from store
  | 'ready'             // Products loaded, ready for purchase
  | 'purchasing'        // Purchase in progress
  | 'restoring'         // Restore in progress
  | 'error'             // Error state
  | 'unavailable';      // IAP not available (web platform)

export interface IAPError {
  code: string;
  message: string;
  step: string;
  timestamp: Date;
}

export interface UseSubscriptionResult {
  // State
  state: IAPState;
  isConnected: boolean;
  isLoading: boolean;
  isPurchasing: boolean;
  isRestoring: boolean;
  isReady: boolean;
  
  // Data
  products: ProductSubscription[];
  error: IAPError | null;
  
  // Debug info
  debugInfo: string;
  
  // Actions
  purchaseSubscription: (productId: string) => Promise<{ success: boolean; error?: string }>;
  restorePurchases: () => Promise<{ success: boolean; message?: string }>;
  refreshProducts: () => Promise<void>;
  retryConnection: () => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function shouldUseNativeIAP(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useSubscription(): UseSubscriptionResult {
  // State management
  const [state, setState] = useState<IAPState>('initializing');
  const [error, setError] = useState<IAPError | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('Initializing...');
  const [productsFetched, setProductsFetched] = useState(false);
  
  // Refs for timeouts and preventing double-fetch
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasFetchedRef = useRef(false);
  const retryCountRef = useRef(0);

  const iapEnabled = shouldUseNativeIAP();

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };
  }, []);

  // Set error helper
  const setIAPError = useCallback((code: string, message: string, step: string) => {
    log('ERROR', step, message, { code });
    setError({ code, message, step, timestamp: new Date() });
    setState('error');
    setDebugInfo(`Errore: ${message}`);
  }, []);

  // Use the expo-iap hook
  const {
    connected,
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    restorePurchases: iapRestorePurchases,
    availablePurchases,
    reconnect,
  } = useIAP(iapEnabled ? {
    onPurchaseSuccess: async (purchase: Purchase) => {
      log('INFO', 'PURCHASE_SUCCESS', 'Purchase success callback received', {
        id: purchase.id,
        productId: purchase.productId,
        transactionId: purchase.transactionId,
      });
    },
    onPurchaseError: (err) => {
      log('ERROR', 'PURCHASE_ERROR', 'Purchase error callback', {
        code: err.code,
        message: err.message,
      });
      
      if (err.code === 'user-cancelled' || err.message?.toLowerCase().includes('cancel')) {
        setState('ready');
        setDebugInfo('Acquisto annullato');
      } else {
        setIAPError(err.code || 'PURCHASE_ERROR', err.message || 'Errore durante l\'acquisto', 'PURCHASE');
      }
    },
    onError: (err) => {
      log('ERROR', 'GENERAL_ERROR', 'General IAP error', { message: err.message });
    },
  } : undefined);

  // ========================================
  // CONNECTION MONITORING
  // ========================================
  
  useEffect(() => {
    if (!iapEnabled) {
      log('INFO', 'INIT', 'IAP not available on this platform');
      setState('unavailable');
      setDebugInfo('IAP non disponibile (web)');
      return;
    }

    log('INFO', 'INIT', 'Starting IAP initialization', { platform: Platform.OS });
    setState('connecting');
    setDebugInfo('Connessione allo store...');

    // Set connection timeout
    connectionTimeoutRef.current = setTimeout(() => {
      if (!connected && state === 'connecting') {
        log('WARN', 'CONNECTION_TIMEOUT', `Connection timeout after ${CONNECTION_TIMEOUT}ms`);
        setIAPError('CONNECTION_TIMEOUT', 'Timeout connessione store. Riprova.', 'CONNECTION');
      }
    }, CONNECTION_TIMEOUT);

    return () => {
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    };
  }, [iapEnabled]);

  // ========================================
  // FETCH PRODUCTS WHEN CONNECTED
  // ========================================
  
  useEffect(() => {
    if (!iapEnabled || !connected) return;

    // Clear connection timeout
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    log('INFO', 'CONNECTED', 'Store connected successfully');
    setState('connected');
    setDebugInfo('Store connesso, caricamento prodotti...');

    // Prevent double-fetch
    if (hasFetchedRef.current) {
      log('DEBUG', 'FETCH_SKIP', 'Products already fetched, skipping');
      return;
    }

    // Fetch products
    const doFetch = async () => {
      hasFetchedRef.current = true;
      setState('fetching');
      setDebugInfo('Caricamento prodotti in corso...');
      
      log('INFO', 'FETCH_START', 'Starting product fetch', { 
        skus: ACTIVE_SUBSCRIPTION_SKUS,
        type: 'subs'
      });

      // Set fetch timeout
      const fetchPromise = fetchProducts({
        skus: ACTIVE_SUBSCRIPTION_SKUS,
        type: 'subs',
      });

      const timeoutPromise = new Promise((_, reject) => {
        fetchTimeoutRef.current = setTimeout(() => {
          reject(new Error('FETCH_TIMEOUT'));
        }, FETCH_PRODUCTS_TIMEOUT);
      });

      try {
        await Promise.race([fetchPromise, timeoutPromise]);
        
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
          fetchTimeoutRef.current = null;
        }

        log('INFO', 'FETCH_COMPLETE', 'Product fetch completed', {
          subscriptionsCount: subscriptions?.length || 0,
        });

        setProductsFetched(true);
        
      } catch (fetchError: any) {
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
          fetchTimeoutRef.current = null;
        }

        if (fetchError.message === 'FETCH_TIMEOUT') {
          log('ERROR', 'FETCH_TIMEOUT', `Product fetch timeout after ${FETCH_PRODUCTS_TIMEOUT}ms`);
          setIAPError('FETCH_TIMEOUT', 'Timeout caricamento prodotti. Verifica connessione.', 'FETCH');
        } else {
          log('ERROR', 'FETCH_ERROR', 'Product fetch failed', { 
            error: fetchError.message,
            code: fetchError.code 
          });
          setIAPError(
            fetchError.code || 'FETCH_ERROR', 
            fetchError.message || 'Errore caricamento prodotti', 
            'FETCH'
          );
        }
      }
    };

    doFetch();
  }, [connected, iapEnabled]);

  // ========================================
  // UPDATE STATE WHEN SUBSCRIPTIONS CHANGE
  // ========================================
  
  useEffect(() => {
    if (!iapEnabled || !productsFetched) return;

    if (subscriptions && subscriptions.length > 0) {
      log('INFO', 'PRODUCTS_LOADED', 'Products available', {
        count: subscriptions.length,
        products: subscriptions.map(s => ({
          id: s.id,
          title: s.title,
          price: (s as any).displayPrice || (s as any).price,
        }))
      });
      setState('ready');
      setError(null);
      setDebugInfo(`${subscriptions.length} prodotto/i caricato/i`);
    } else {
      log('WARN', 'PRODUCTS_EMPTY', 'No products returned from store', {
        skusRequested: ACTIVE_SUBSCRIPTION_SKUS,
        hint: 'Verifica che il Product ID su App Store Connect corrisponda esattamente'
      });
      setIAPError(
        'NO_PRODUCTS',
        'Nessun prodotto trovato. Verifica configurazione App Store Connect.',
        'PRODUCTS'
      );
    }
  }, [subscriptions, productsFetched, iapEnabled]);

  // ========================================
  // ACTIONS
  // ========================================
  
  const purchaseSubscription = useCallback(async (productId: string): Promise<{ success: boolean; error?: string }> => {
    if (!iapEnabled) {
      return { success: false, error: 'IAP non disponibile' };
    }

    if (!connected) {
      return { success: false, error: 'Store non connesso' };
    }

    if (!subscriptions || subscriptions.length === 0) {
      return { success: false, error: 'Prodotti non caricati' };
    }

    setState('purchasing');
    setDebugInfo('Acquisto in corso...');
    log('INFO', 'PURCHASE_START', 'Starting purchase', { productId });

    try {
      // Find subscription for Android offer token
      let offerToken: string | undefined;
      if (Platform.OS === 'android') {
        const subscription = subscriptions.find(s => s.id === productId);
        if (subscription && 'subscriptionOfferDetailsAndroid' in subscription) {
          const offers = (subscription as any).subscriptionOfferDetailsAndroid;
          if (offers && offers.length > 0) {
            offerToken = offers[0].offerToken;
            log('DEBUG', 'ANDROID_OFFER', 'Found Android offer token', { offerToken });
          }
        }
      }

      // Request purchase
      const result = await requestPurchase({
        type: 'subs',
        request: {
          apple: Platform.OS === 'ios' ? { sku: productId } : undefined,
          google: Platform.OS === 'android' ? {
            skus: [productId],
            subscriptionOffers: offerToken ? [{ sku: productId, offerToken }] : undefined,
          } : undefined,
        },
      });

      log('INFO', 'PURCHASE_RESULT', 'Purchase request completed', { result });

      if (result) {
        const purchase = Array.isArray(result) ? result[0] : result;
        
        if (purchase) {
          // Validate with backend
          log('INFO', 'VALIDATE_START', 'Validating purchase with backend');
          
          const receipt = Platform.OS === 'ios'
            ? (purchase as any).transactionReceipt || (purchase as any).jws
            : (purchase as any).purchaseToken;

          const validation = await apiClient.validateIAPPurchase({
            platform: Platform.OS as 'ios' | 'android',
            product_id: purchase.productId || productId,
            transaction_id: purchase.transactionId || (purchase as any).purchaseToken || purchase.id,
            receipt: receipt || '',
            plan_id: productId.includes('yearly') ? 'yearly' : 'monthly',
          });

          if (validation.success) {
            log('INFO', 'VALIDATE_SUCCESS', 'Backend validation successful');
            
            // Finish transaction
            try {
              await finishTransaction({ purchase, isConsumable: false });
              log('INFO', 'TRANSACTION_FINISHED', 'Transaction finished');
            } catch (finishErr) {
              log('WARN', 'FINISH_ERROR', 'Error finishing transaction', { error: finishErr });
            }

            setState('ready');
            setDebugInfo('Abbonamento attivato!');
            return { success: true };
          } else {
            log('ERROR', 'VALIDATE_FAILED', 'Backend validation failed', { validation });
            setState('ready');
            return { success: false, error: validation.message || 'Validazione fallita' };
          }
        }
      }

      setState('ready');
      return { success: false, error: 'Acquisto non completato' };

    } catch (err: any) {
      log('ERROR', 'PURCHASE_EXCEPTION', 'Purchase exception', { 
        message: err.message,
        code: err.code 
      });

      setState('ready');

      if (err.message?.toLowerCase().includes('cancel') || err.code === 'user-cancelled') {
        return { success: false, error: 'cancelled' };
      }

      if (err.code === 'already-owned') {
        return { success: false, error: 'Hai già un abbonamento attivo' };
      }

      return { success: false, error: err.message || 'Errore durante l\'acquisto' };
    }
  }, [iapEnabled, connected, subscriptions, requestPurchase, finishTransaction]);

  const restorePurchases = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    if (!iapEnabled) {
      return { success: false, message: 'IAP non disponibile' };
    }

    if (!connected) {
      return { success: false, message: 'Store non connesso' };
    }

    setState('restoring');
    setDebugInfo('Ripristino acquisti...');
    log('INFO', 'RESTORE_START', 'Starting restore purchases');

    try {
      await iapRestorePurchases();
      
      log('INFO', 'RESTORE_COMPLETE', 'Restore completed', {
        availablePurchasesCount: availablePurchases?.length || 0
      });

      if (availablePurchases && availablePurchases.length > 0) {
        const subscriptionPurchase = availablePurchases.find((p: Purchase) =>
          p.productId?.includes('subscription') ||
          ACTIVE_SUBSCRIPTION_SKUS.includes(p.productId || '')
        );

        if (subscriptionPurchase) {
          const receipt = Platform.OS === 'ios'
            ? (subscriptionPurchase as any).transactionReceipt || (subscriptionPurchase as any).jws
            : (subscriptionPurchase as any).purchaseToken;

          const validation = await apiClient.validateIAPPurchase({
            platform: Platform.OS as 'ios' | 'android',
            product_id: subscriptionPurchase.productId || '',
            transaction_id: subscriptionPurchase.transactionId || (subscriptionPurchase as any).purchaseToken || '',
            receipt: receipt || '',
            plan_id: subscriptionPurchase.productId?.includes('yearly') ? 'yearly' : 'monthly',
          });

          if (validation.success) {
            setState('ready');
            setDebugInfo('Abbonamento ripristinato!');
            return { success: true, message: 'Abbonamento ripristinato con successo!' };
          }
        }
      }

      // Try backend restore
      try {
        const backendRestore = await apiClient.restoreIAPPurchases();
        setState('ready');
        
        if (backendRestore.success) {
          setDebugInfo('Abbonamento ripristinato!');
          return { success: true, message: backendRestore.message };
        }
      } catch (backendErr) {
        log('WARN', 'BACKEND_RESTORE_FAILED', 'Backend restore failed', { error: backendErr });
      }

      setState('ready');
      setDebugInfo('Nessun abbonamento trovato');
      return { success: false, message: 'Nessun abbonamento da ripristinare' };

    } catch (err: any) {
      log('ERROR', 'RESTORE_ERROR', 'Restore error', { message: err.message });
      setState('ready');
      return { success: false, message: err.message || 'Errore nel ripristino' };
    }
  }, [iapEnabled, connected, iapRestorePurchases, availablePurchases]);

  const refreshProducts = useCallback(async () => {
    if (!iapEnabled || !connected) return;

    log('INFO', 'REFRESH_START', 'Refreshing products');
    hasFetchedRef.current = false;
    setProductsFetched(false);
    setState('fetching');
    setDebugInfo('Ricaricamento prodotti...');

    try {
      await fetchProducts({
        skus: ACTIVE_SUBSCRIPTION_SKUS,
        type: 'subs',
      });
      setProductsFetched(true);
    } catch (err: any) {
      log('ERROR', 'REFRESH_ERROR', 'Refresh failed', { message: err.message });
      setIAPError('REFRESH_ERROR', err.message || 'Errore ricaricamento', 'REFRESH');
    }
  }, [iapEnabled, connected, fetchProducts]);

  const retryConnection = useCallback(() => {
    log('INFO', 'RETRY', 'Retrying connection');
    retryCountRef.current++;
    hasFetchedRef.current = false;
    setProductsFetched(false);
    setState('connecting');
    setError(null);
    setDebugInfo('Riconnessione...');
    
    if (reconnect) {
      reconnect().catch((err) => {
        log('ERROR', 'RECONNECT_ERROR', 'Reconnect failed', { error: err });
      });
    }
  }, [reconnect]);

  // ========================================
  // RETURN VALUES
  // ========================================

  // Web platform fallback
  if (!iapEnabled) {
    return {
      state: 'unavailable',
      isConnected: false,
      isLoading: false,
      isPurchasing: false,
      isRestoring: false,
      isReady: false,
      products: [],
      error: null,
      debugInfo: 'IAP non disponibile (web)',
      purchaseSubscription: async () => ({ success: false, error: 'Use Stripe on web' }),
      restorePurchases: async () => ({ success: false, message: 'Not available on web' }),
      refreshProducts: async () => {},
      retryConnection: () => {},
    };
  }

  return {
    state,
    isConnected: connected,
    isLoading: state === 'initializing' || state === 'connecting' || state === 'fetching',
    isPurchasing: state === 'purchasing',
    isRestoring: state === 'restoring',
    isReady: state === 'ready' && subscriptions.length > 0,
    products: subscriptions || [],
    error,
    debugInfo,
    purchaseSubscription,
    restorePurchases,
    refreshProducts,
    retryConnection,
  };
}
