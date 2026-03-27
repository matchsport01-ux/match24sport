// useSubscription.ts - Hook for native iOS StoreKit and Android Google Play Billing
// CRITICAL FIX: Uses getSubscriptions() for subscriptions, NOT fetchProducts()
// CRITICAL FIX: Enables StoreKit 2 mode for TestFlight/Production compatibility
import { useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { apiClient } from '../api/client';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Product IDs - MUST match EXACTLY what's in App Store Connect / Google Play Console
export const PRODUCT_IDS = {
  MONTHLY: 'com.matchsport24.subscription.monthly.v2',
  YEARLY: 'com.matchsport24.subscription.yearly.v2',
};

// Active SKUs to fetch (only monthly for now)
export const ACTIVE_SUBSCRIPTION_SKUS = [PRODUCT_IDS.MONTHLY];

// Timeouts
const FETCH_PRODUCTS_TIMEOUT = 20000; // 20 seconds (increased for StoreKit 2)
const CONNECTION_TIMEOUT = 15000; // 15 seconds

// ============================================================================
// LOGGING
// ============================================================================

const log = (level: string, step: string, message: string, data?: any) => {
  const prefix = `[IAP][${level}][${step}]`;
  if (__DEV__) {
    if (data !== undefined) {
      console.log(prefix, message, data);
    } else {
      console.log(prefix, message);
    }
  }
};

// ============================================================================
// TYPES
// ============================================================================

export type IAPState = 
  | 'initializing'
  | 'connecting'
  | 'connected'
  | 'fetching'
  | 'ready'
  | 'purchasing'
  | 'restoring'
  | 'error'
  | 'unavailable';

export interface IAPError {
  code: string;
  message: string;
  step: string;
  timestamp: Date;
}

export interface UseSubscriptionResult {
  state: IAPState;
  isConnected: boolean;
  isLoading: boolean;
  isPurchasing: boolean;
  isRestoring: boolean;
  isReady: boolean;
  products: any[];
  error: IAPError | null;
  debugInfo: string;
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

function isExpoGo(): boolean {
  try {
    const Constants = require('expo-constants').default;
    return Constants.appOwnership === 'expo';
  } catch {
    return false;
  }
}

function isNativeIAPModuleAvailable(): boolean {
  try {
    const { requireOptionalNativeModule } = require('expo-modules-core');
    const ExpoIapModule = requireOptionalNativeModule('ExpoIap');
    return ExpoIapModule !== null && ExpoIapModule !== undefined;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// WEB/EXPO GO FALLBACK HOOK
// ============================================================================

function useSubscriptionFallback(reason: string): UseSubscriptionResult {
  return {
    state: 'unavailable',
    isConnected: false,
    isLoading: false,
    isPurchasing: false,
    isRestoring: false,
    isReady: false,
    products: [],
    error: {
      code: 'IAP_UNAVAILABLE',
      message: reason,
      step: 'INIT',
      timestamp: new Date(),
    },
    debugInfo: reason,
    purchaseSubscription: async () => ({ success: false, error: reason }),
    restorePurchases: async () => ({ success: false, message: reason }),
    refreshProducts: async () => {},
    retryConnection: () => {},
  };
}

// ============================================================================
// NATIVE IAP HOOK (iOS/Android only)
// ============================================================================

function useSubscriptionNative(): UseSubscriptionResult {
  const [iapModule, setIapModule] = useState<any>(null);
  const [state, setState] = useState<IAPState>('initializing');
  const [error, setError] = useState<IAPError | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('Inizializzazione...');
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);
  
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasFetchedRef = useRef(false);
  const iapFunctionsRef = useRef<any>(null);
  const mountedRef = useRef(true);

  const setIAPError = useCallback((code: string, message: string, step: string) => {
    log('ERROR', step, message, { code });
    if (mountedRef.current) {
      setError({ code, message, step, timestamp: new Date() });
      setState('error');
      setDebugInfo(`Errore: ${message}`);
    }
  }, []);

  // Load expo-iap module
  useEffect(() => {
    mountedRef.current = true;

    const loadIAP = async () => {
      try {
        log('INFO', 'INIT', 'Loading expo-iap module...');
        const expoIap = await import('expo-iap');
        
        if (!mountedRef.current) return;
        
        log('INFO', 'INIT', 'Module loaded, available functions:', Object.keys(expoIap));
        setIapModule(expoIap);
      } catch (err: any) {
        log('ERROR', 'INIT', 'Failed to load expo-iap', err.message);
        if (mountedRef.current) {
          setIAPError('MODULE_LOAD_ERROR', 'Impossibile caricare il modulo IAP', 'INIT');
        }
      }
    };

    loadIAP();

    return () => {
      mountedRef.current = false;
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };
  }, []);

  // Initialize IAP when module is loaded
  useEffect(() => {
    if (!iapModule) return;

    let iapCleanup: (() => void) | undefined;

    const initializeIAP = async () => {
      try {
        log('INFO', 'CONNECT', 'Initializing IAP connection...');
        setState('connecting');
        setDebugInfo('Connessione allo store...');

        connectionTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current && state === 'connecting') {
            log('WARN', 'CONNECTION_TIMEOUT', 'Connection timeout');
            setIAPError('CONNECTION_TIMEOUT', 'Timeout connessione store', 'CONNECTION');
          }
        }, CONNECTION_TIMEOUT);

        // Store all IAP functions
        iapFunctionsRef.current = iapModule;

        // CRITICAL: Enable StoreKit 2 mode for iOS 15+ and TestFlight
        // This is REQUIRED for subscriptions to work in production/TestFlight
        if (Platform.OS === 'ios' && iapModule.setup) {
          try {
            log('INFO', 'SETUP', 'Enabling StoreKit 2 mode...');
            await iapModule.setup({ storekitMode: 'STOREKIT2_MODE' });
            log('INFO', 'SETUP', 'StoreKit 2 mode enabled');
          } catch (setupErr: any) {
            log('WARN', 'SETUP', 'StoreKit 2 setup warning (may not be available):', setupErr.message);
            // Continue anyway - might not be available in all versions
          }
        }

        // Initialize connection
        const { initConnection, purchaseUpdatedListener, purchaseErrorListener } = iapModule;
        
        log('INFO', 'CONNECT', 'Calling initConnection...');
        const connectionResult = await initConnection();
        log('INFO', 'CONNECT', 'Connection result:', connectionResult);

        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }

        if (!mountedRef.current) return;

        setConnected(true);
        setState('connected');
        setDebugInfo('Connesso, caricamento prodotti...');
        log('INFO', 'CONNECTED', 'Store connected');

        // Set up listeners
        const purchaseUpdateSubscription = purchaseUpdatedListener?.(async (purchase: any) => {
          log('INFO', 'PURCHASE_UPDATE', 'Purchase updated', purchase?.productId);
        });

        const purchaseErrorSubscription = purchaseErrorListener?.((err: any) => {
          log('ERROR', 'PURCHASE_ERROR', 'Purchase error', err?.message);
        });

        iapCleanup = () => {
          purchaseUpdateSubscription?.remove?.();
          purchaseErrorSubscription?.remove?.();
        };

        // Fetch subscriptions
        if (!hasFetchedRef.current) {
          await fetchSubscriptionsInternal();
        }

      } catch (err: any) {
        log('ERROR', 'INIT_ERROR', 'IAP init failed', err.message);
        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
        if (mountedRef.current) {
          setIAPError('INIT_ERROR', err.message || 'Errore inizializzazione', 'INIT');
        }
      }
    };

    const fetchSubscriptionsInternal = async () => {
      if (!iapFunctionsRef.current || !mountedRef.current) return;
      
      hasFetchedRef.current = true;
      setState('fetching');
      setDebugInfo('Caricamento abbonamenti...');
      
      log('INFO', 'FETCH_START', 'Fetching subscriptions with SKUs:', ACTIVE_SUBSCRIPTION_SKUS);

      fetchTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          log('ERROR', 'FETCH_TIMEOUT', 'Fetch timeout');
          setIAPError('FETCH_TIMEOUT', 'Timeout caricamento abbonamenti', 'FETCH');
        }
      }, FETCH_PRODUCTS_TIMEOUT);

      try {
        // CRITICAL FIX: Use getSubscriptions() for subscriptions, NOT fetchProducts()
        // fetchProducts() is for consumables/non-consumables only!
        const { getSubscriptions, getProducts } = iapFunctionsRef.current;
        
        let subs: any[] = [];
        
        // Method 1: Try getSubscriptions (correct for subscriptions)
        if (typeof getSubscriptions === 'function') {
          log('INFO', 'FETCH', 'Using getSubscriptions()...');
          try {
            subs = await getSubscriptions({ skus: ACTIVE_SUBSCRIPTION_SKUS });
            log('INFO', 'FETCH', 'getSubscriptions result:', subs?.length || 0);
          } catch (subErr: any) {
            log('WARN', 'FETCH', 'getSubscriptions error:', subErr.message);
          }
        }
        
        // Method 2: Fallback to getProducts if getSubscriptions didn't work
        if ((!subs || subs.length === 0) && typeof getProducts === 'function') {
          log('INFO', 'FETCH', 'Trying getProducts fallback...');
          try {
            subs = await getProducts({ skus: ACTIVE_SUBSCRIPTION_SKUS });
            log('INFO', 'FETCH', 'getProducts result:', subs?.length || 0);
          } catch (prodErr: any) {
            log('WARN', 'FETCH', 'getProducts error:', prodErr.message);
          }
        }
        
        // Method 3: Try fetchProducts with type subs (expo-iap specific)
        if ((!subs || subs.length === 0) && iapFunctionsRef.current.fetchProducts) {
          log('INFO', 'FETCH', 'Trying fetchProducts({ type: subs })...');
          try {
            subs = await iapFunctionsRef.current.fetchProducts({ 
              skus: ACTIVE_SUBSCRIPTION_SKUS, 
              type: 'subs' 
            });
            log('INFO', 'FETCH', 'fetchProducts(subs) result:', subs?.length || 0);
          } catch (fetchErr: any) {
            log('WARN', 'FETCH', 'fetchProducts error:', fetchErr.message);
          }
        }
        
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
          fetchTimeoutRef.current = null;
        }

        if (!mountedRef.current) return;

        log('INFO', 'FETCH_COMPLETE', 'Final products count:', subs?.length || 0);
        
        if (subs && subs.length > 0) {
          // Log product details for debugging
          subs.forEach((s: any, i: number) => {
            log('INFO', 'PRODUCT', `Product ${i}:`, {
              id: s.productId || s.id,
              price: s.localizedPrice || s.displayPrice || s.price,
              title: s.title || s.name,
            });
          });
          
          setSubscriptions(subs);
          setState('ready');
          setError(null);
          setDebugInfo(`${subs.length} abbonamento/i trovato/i`);
        } else {
          log('WARN', 'PRODUCTS_EMPTY', 'No subscriptions found');
          log('WARN', 'PRODUCTS_EMPTY', 'SKUs requested:', ACTIVE_SUBSCRIPTION_SKUS);
          log('WARN', 'PRODUCTS_EMPTY', 'Possible causes:');
          log('WARN', 'PRODUCTS_EMPTY', '1. SKU mismatch with App Store Connect');
          log('WARN', 'PRODUCTS_EMPTY', '2. Subscription not approved yet');
          log('WARN', 'PRODUCTS_EMPTY', '3. Pricing not set for all regions');
          log('WARN', 'PRODUCTS_EMPTY', '4. Not signed in with sandbox account');
          
          // Don't set error - just mark as ready with empty products
          // The UI will handle showing appropriate message
          setState('ready');
          setDebugInfo('Nessun abbonamento disponibile');
        }
      } catch (fetchErr: any) {
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        log('ERROR', 'FETCH_ERROR', 'Fetch exception:', fetchErr.message);
        if (mountedRef.current) {
          // Don't set error state - let UI handle gracefully
          setState('ready');
          setDebugInfo('Errore caricamento: ' + fetchErr.message);
        }
      }
    };

    initializeIAP();

    return () => {
      if (iapCleanup) iapCleanup();
      if (iapModule?.endConnection) {
        iapModule.endConnection().catch(() => {});
      }
    };
  }, [iapModule]);

  // Purchase subscription
  const purchaseSubscription = useCallback(async (productId: string): Promise<{ success: boolean; error?: string }> => {
    if (!iapFunctionsRef.current) {
      return { success: false, error: 'IAP non inizializzato' };
    }

    if (!connected) {
      return { success: false, error: 'Store non connesso' };
    }

    setState('purchasing');
    setDebugInfo('Acquisto in corso...');
    log('INFO', 'PURCHASE_START', 'Starting purchase for:', productId);

    try {
      const { requestSubscription, finishTransaction } = iapFunctionsRef.current;

      const subscription = subscriptions.find(s => 
        s.productId === productId || s.id === productId
      );
      
      let purchaseParams: any = { sku: productId };
      
      // Android requires offer token
      if (Platform.OS === 'android' && subscription?.subscriptionOfferDetails) {
        const offer = subscription.subscriptionOfferDetails[0];
        if (offer?.offerToken) {
          purchaseParams.subscriptionOffers = [{ sku: productId, offerToken: offer.offerToken }];
        }
      }

      log('INFO', 'PURCHASE', 'Calling requestSubscription with:', purchaseParams);
      const purchase = await requestSubscription(purchaseParams);
      log('INFO', 'PURCHASE_RESULT', 'Purchase result:', purchase);

      if (purchase) {
        const receipt = Platform.OS === 'ios' 
          ? purchase.transactionReceipt 
          : purchase.purchaseToken;

        log('INFO', 'VALIDATE', 'Validating with backend...');
        const validation = await apiClient.validateIAPPurchase({
          platform: Platform.OS as 'ios' | 'android',
          product_id: productId,
          transaction_id: purchase.transactionId || purchase.purchaseToken || '',
          receipt: receipt || '',
          plan_id: productId.includes('yearly') ? 'yearly' : 'monthly',
        });

        if (validation.success) {
          log('INFO', 'VALIDATE_SUCCESS', 'Validation successful');
          
          try {
            await finishTransaction({ purchase, isConsumable: false });
          } catch (finishErr) {
            log('WARN', 'FINISH_ERROR', 'Error finishing transaction');
          }

          setState('ready');
          setDebugInfo('Abbonamento attivato!');
          return { success: true };
        } else {
          setState('ready');
          return { success: false, error: validation.message || 'Validazione fallita' };
        }
      }

      setState('ready');
      return { success: false, error: 'Acquisto non completato' };

    } catch (err: any) {
      log('ERROR', 'PURCHASE_ERROR', 'Purchase error:', err.message, err.code);
      setState('ready');

      if (err.code === 'E_USER_CANCELLED' || err.message?.toLowerCase().includes('cancel')) {
        return { success: false, error: 'cancelled' };
      }

      if (err.code === 'E_ALREADY_OWNED') {
        return { success: false, error: 'Hai già un abbonamento attivo' };
      }

      return { success: false, error: err.message || 'Errore durante l\'acquisto' };
    }
  }, [connected, subscriptions]);

  // Restore purchases
  const restorePurchases = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    if (!iapFunctionsRef.current) {
      return { success: false, message: 'IAP non inizializzato' };
    }

    setState('restoring');
    setDebugInfo('Ripristino acquisti...');
    log('INFO', 'RESTORE_START', 'Starting restore');

    try {
      const { getAvailablePurchases } = iapFunctionsRef.current;
      const purchases = await getAvailablePurchases();
      
      log('INFO', 'RESTORE_RESULT', 'Purchases found:', purchases?.length || 0);

      if (purchases && purchases.length > 0) {
        const subscriptionPurchase = purchases.find((p: any) => 
          ACTIVE_SUBSCRIPTION_SKUS.includes(p.productId)
        );

        if (subscriptionPurchase) {
          const receipt = Platform.OS === 'ios'
            ? subscriptionPurchase.transactionReceipt
            : subscriptionPurchase.purchaseToken;

          const validation = await apiClient.validateIAPPurchase({
            platform: Platform.OS as 'ios' | 'android',
            product_id: subscriptionPurchase.productId,
            transaction_id: subscriptionPurchase.transactionId || subscriptionPurchase.purchaseToken || '',
            receipt: receipt || '',
            plan_id: subscriptionPurchase.productId?.includes('yearly') ? 'yearly' : 'monthly',
          });

          if (validation.success) {
            setState('ready');
            setDebugInfo('Abbonamento ripristinato!');
            return { success: true, message: 'Abbonamento ripristinato!' };
          }
        }
      }

      // Try backend restore
      try {
        const backendRestore = await apiClient.restoreIAPPurchases();
        if (backendRestore.success) {
          setState('ready');
          return { success: true, message: backendRestore.message };
        }
      } catch (backendErr) {
        log('WARN', 'BACKEND_RESTORE', 'Backend restore failed');
      }

      setState('ready');
      setDebugInfo('Nessun abbonamento trovato');
      return { success: false, message: 'Nessun abbonamento da ripristinare' };

    } catch (err: any) {
      log('ERROR', 'RESTORE_ERROR', 'Restore error:', err.message);
      setState('ready');
      return { success: false, message: err.message || 'Errore nel ripristino' };
    }
  }, []);

  // Refresh products
  const refreshProducts = useCallback(async () => {
    if (!iapFunctionsRef.current || !connected) return;

    log('INFO', 'REFRESH', 'Refreshing subscriptions');
    hasFetchedRef.current = false;
    setState('fetching');
    setDebugInfo('Ricaricamento...');

    try {
      const { getSubscriptions, getProducts, fetchProducts } = iapFunctionsRef.current;
      let subs: any[] = [];
      
      // Try all methods
      if (typeof getSubscriptions === 'function') {
        try {
          subs = await getSubscriptions({ skus: ACTIVE_SUBSCRIPTION_SKUS });
        } catch (e) {}
      }
      
      if ((!subs || subs.length === 0) && typeof getProducts === 'function') {
        try {
          subs = await getProducts({ skus: ACTIVE_SUBSCRIPTION_SKUS });
        } catch (e) {}
      }
      
      if ((!subs || subs.length === 0) && typeof fetchProducts === 'function') {
        try {
          subs = await fetchProducts({ skus: ACTIVE_SUBSCRIPTION_SKUS, type: 'subs' });
        } catch (e) {}
      }
      
      if (subs && subs.length > 0) {
        setSubscriptions(subs);
        setState('ready');
        setError(null);
        setDebugInfo(`${subs.length} abbonamento/i trovato/i`);
      } else {
        setState('ready');
        setDebugInfo('Nessun abbonamento disponibile');
      }
    } catch (err: any) {
      setState('ready');
      setDebugInfo('Errore ricaricamento');
    }
  }, [connected]);

  // Retry connection
  const retryConnection = useCallback(() => {
    log('INFO', 'RETRY', 'Retrying connection');
    hasFetchedRef.current = false;
    setSubscriptions([]);
    setConnected(false);
    setState('initializing');
    setError(null);
    setDebugInfo('Riconnessione...');
    
    setIapModule(null);
    setTimeout(() => {
      import('expo-iap').then(mod => setIapModule(mod)).catch(() => {});
    }, 100);
  }, []);

  return {
    state,
    isConnected: connected,
    isLoading: state === 'initializing' || state === 'connecting' || state === 'fetching',
    isPurchasing: state === 'purchasing',
    isRestoring: state === 'restoring',
    isReady: state === 'ready',
    products: subscriptions,
    error,
    debugInfo,
    purchaseSubscription,
    restorePurchases,
    refreshProducts,
    retryConnection,
  };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export function useSubscription(): UseSubscriptionResult {
  if (Platform.OS === 'web') {
    return useSubscriptionFallback('IAP non disponibile (web) - Usa Stripe');
  }
  
  if (isExpoGo()) {
    return useSubscriptionFallback('IAP non disponibile in Expo Go. Serve TestFlight o Development Build.');
  }
  
  if (!isNativeIAPModuleAvailable()) {
    return useSubscriptionFallback('Modulo nativo ExpoIap non trovato.');
  }
  
  return useSubscriptionNative();
}
