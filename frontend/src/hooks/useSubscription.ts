// useSubscription.ts - Hook for native iOS StoreKit and Android Google Play Billing
// Handles web platform gracefully without importing native modules
import { useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
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

// Check if we're running in Expo Go (which doesn't support custom native modules)
function isExpoGo(): boolean {
  try {
    // In Expo Go, Constants.appOwnership is 'expo'
    // In standalone/dev builds, it's 'standalone' or undefined
    const Constants = require('expo-constants').default;
    return Constants.appOwnership === 'expo';
  } catch {
    return false;
  }
}

// Check if the native IAP module is actually available
// IMPORTANT: expo-iap uses Expo Modules Architecture, NOT traditional NativeModules
// We must use requireOptionalNativeModule from 'expo-modules-core' to check availability
function isNativeIAPModuleAvailable(): boolean {
  try {
    // For Expo Modules (like expo-iap), we need to use requireOptionalNativeModule
    // NOT NativeModules which is for legacy React Native modules
    // requireOptionalNativeModule returns null if module not found (doesn't throw)
    const { requireOptionalNativeModule } = require('expo-modules-core');
    const ExpoIapModule = requireOptionalNativeModule('ExpoIap');
    const available = ExpoIapModule !== null && ExpoIapModule !== undefined;
    console.log('[IAP] Native module check result:', available);
    return available;
  } catch (error: any) {
    // Module not available - this is expected in Expo Go or if build doesn't include it
    console.log('[IAP] Native module check failed:', error?.message || error);
    return false;
  }
}

// ============================================================================
// WEB/EXPO GO FALLBACK HOOK (No native IAP available)
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
  // Dynamically import expo-iap only on native platforms
  const [iapModule, setIapModule] = useState<any>(null);
  const [iapHookResult, setIapHookResult] = useState<any>(null);
  
  // State management
  const [state, setState] = useState<IAPState>('initializing');
  const [error, setError] = useState<IAPError | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('Inizializzazione...');
  const [productsFetched, setProductsFetched] = useState(false);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);
  
  // Refs
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasFetchedRef = useRef(false);
  const iapFunctionsRef = useRef<any>(null);

  // Set error helper
  const setIAPError = useCallback((code: string, message: string, step: string) => {
    log('ERROR', step, message, { code });
    setError({ code, message, step, timestamp: new Date() });
    setState('error');
    setDebugInfo(`Errore: ${message}`);
  }, []);

  // Load expo-iap dynamically
  useEffect(() => {
    let mounted = true;

    const loadIAP = async () => {
      try {
        log('INFO', 'INIT', 'Loading expo-iap module...');
        const expoIap = await import('expo-iap');
        
        if (!mounted) return;
        
        setIapModule(expoIap);
        log('INFO', 'INIT', 'expo-iap module loaded successfully');
      } catch (err: any) {
        log('ERROR', 'INIT', 'Failed to load expo-iap', { error: err.message });
        if (mounted) {
          setIAPError('MODULE_LOAD_ERROR', 'Impossibile caricare il modulo IAP', 'INIT');
        }
      }
    };

    loadIAP();

    return () => {
      mounted = false;
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

        // Set connection timeout
        connectionTimeoutRef.current = setTimeout(() => {
          if (state === 'connecting') {
            log('WARN', 'CONNECTION_TIMEOUT', `Connection timeout after ${CONNECTION_TIMEOUT}ms`);
            setIAPError('CONNECTION_TIMEOUT', 'Timeout connessione store. Riprova.', 'CONNECTION');
          }
        }, CONNECTION_TIMEOUT);

        // Initialize IAP
        const { initConnection, purchaseUpdatedListener, purchaseErrorListener, getSubscriptions } = iapModule;
        
        // Store functions for later use
        iapFunctionsRef.current = iapModule;

        const connectionResult = await initConnection();
        log('INFO', 'CONNECT', 'Connection result', { result: connectionResult });

        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }

        setConnected(true);
        setState('connected');
        setDebugInfo('Connesso, caricamento prodotti...');
        log('INFO', 'CONNECTED', 'Store connected successfully');

        // Set up purchase listeners
        const purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase: any) => {
          log('INFO', 'PURCHASE_UPDATE', 'Purchase updated', { 
            productId: purchase.productId,
            transactionId: purchase.transactionId 
          });
        });

        const purchaseErrorSubscription = purchaseErrorListener((err: any) => {
          log('ERROR', 'PURCHASE_ERROR', 'Purchase error', { 
            code: err.code, 
            message: err.message 
          });
        });

        iapCleanup = () => {
          purchaseUpdateSubscription?.remove?.();
          purchaseErrorSubscription?.remove?.();
        };

        // Fetch subscriptions
        if (!hasFetchedRef.current) {
          await fetchProductsInternal();
        }

      } catch (err: any) {
        log('ERROR', 'INIT_ERROR', 'IAP initialization failed', { error: err.message });
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }
        setIAPError('INIT_ERROR', err.message || 'Errore inizializzazione IAP', 'INIT');
      }
    };

    const fetchProductsInternal = async () => {
      if (!iapFunctionsRef.current) return;
      
      hasFetchedRef.current = true;
      setState('fetching');
      setDebugInfo('Caricamento prodotti...');
      
      log('INFO', 'FETCH_START', 'Starting product fetch', { 
        skus: ACTIVE_SUBSCRIPTION_SKUS 
      });

      fetchTimeoutRef.current = setTimeout(() => {
        log('ERROR', 'FETCH_TIMEOUT', `Product fetch timeout after ${FETCH_PRODUCTS_TIMEOUT}ms`);
        setIAPError('FETCH_TIMEOUT', 'Timeout caricamento prodotti', 'FETCH');
      }, FETCH_PRODUCTS_TIMEOUT);

      try {
        const { getSubscriptions } = iapFunctionsRef.current;
        const subs = await getSubscriptions({ skus: ACTIVE_SUBSCRIPTION_SKUS });
        
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
          fetchTimeoutRef.current = null;
        }

        log('INFO', 'FETCH_COMPLETE', 'Products fetched', { 
          count: subs?.length || 0,
          products: subs?.map((s: any) => ({ id: s.productId, price: s.localizedPrice }))
        });

        if (subs && subs.length > 0) {
          setSubscriptions(subs);
          setProductsFetched(true);
          setState('ready');
          setError(null);
          setDebugInfo(`${subs.length} prodotto/i caricato/i`);
        } else {
          log('WARN', 'PRODUCTS_EMPTY', 'No products returned', {
            hint: 'Verifica Product ID su App Store Connect'
          });
          setIAPError('NO_PRODUCTS', 'Nessun prodotto trovato. Verifica App Store Connect.', 'PRODUCTS');
        }
      } catch (fetchErr: any) {
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
        }
        log('ERROR', 'FETCH_ERROR', 'Fetch failed', { error: fetchErr.message });
        setIAPError('FETCH_ERROR', fetchErr.message || 'Errore caricamento prodotti', 'FETCH');
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
    log('INFO', 'PURCHASE_START', 'Starting purchase', { productId });

    try {
      const { requestSubscription, finishTransaction } = iapFunctionsRef.current;

      // Find the subscription
      const subscription = subscriptions.find(s => s.productId === productId);
      
      let purchaseParams: any = { sku: productId };
      
      // For Android, include offer token if available
      if (Platform.OS === 'android' && subscription?.subscriptionOfferDetails) {
        const offer = subscription.subscriptionOfferDetails[0];
        if (offer?.offerToken) {
          purchaseParams.subscriptionOffers = [{ sku: productId, offerToken: offer.offerToken }];
        }
      }

      const purchase = await requestSubscription(purchaseParams);
      log('INFO', 'PURCHASE_RESULT', 'Purchase completed', { purchase });

      if (purchase) {
        // Validate with backend
        const receipt = Platform.OS === 'ios' 
          ? purchase.transactionReceipt 
          : purchase.purchaseToken;

        const validation = await apiClient.validateIAPPurchase({
          platform: Platform.OS as 'ios' | 'android',
          product_id: productId,
          transaction_id: purchase.transactionId || purchase.purchaseToken || '',
          receipt: receipt || '',
          plan_id: productId.includes('yearly') ? 'yearly' : 'monthly',
        });

        if (validation.success) {
          log('INFO', 'VALIDATE_SUCCESS', 'Backend validation successful');
          
          // Finish transaction
          try {
            await finishTransaction({ purchase, isConsumable: false });
            log('INFO', 'FINISH_SUCCESS', 'Transaction finished');
          } catch (finishErr) {
            log('WARN', 'FINISH_ERROR', 'Error finishing transaction', { error: finishErr });
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
      log('ERROR', 'PURCHASE_ERROR', 'Purchase exception', { error: err.message, code: err.code });
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

    if (!connected) {
      return { success: false, message: 'Store non connesso' };
    }

    setState('restoring');
    setDebugInfo('Ripristino acquisti...');
    log('INFO', 'RESTORE_START', 'Starting restore');

    try {
      const { getAvailablePurchases } = iapFunctionsRef.current;
      const purchases = await getAvailablePurchases();
      
      log('INFO', 'RESTORE_RESULT', 'Restore completed', { count: purchases?.length || 0 });

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
            return { success: true, message: 'Abbonamento ripristinato con successo!' };
          }
        }
      }

      // Try backend restore
      try {
        const backendRestore = await apiClient.restoreIAPPurchases();
        if (backendRestore.success) {
          setState('ready');
          setDebugInfo('Abbonamento ripristinato!');
          return { success: true, message: backendRestore.message };
        }
      } catch (backendErr) {
        log('WARN', 'BACKEND_RESTORE_FAILED', 'Backend restore failed');
      }

      setState('ready');
      setDebugInfo('Nessun abbonamento trovato');
      return { success: false, message: 'Nessun abbonamento da ripristinare' };

    } catch (err: any) {
      log('ERROR', 'RESTORE_ERROR', 'Restore error', { error: err.message });
      setState('ready');
      return { success: false, message: err.message || 'Errore nel ripristino' };
    }
  }, [connected]);

  // Refresh products
  const refreshProducts = useCallback(async () => {
    if (!iapFunctionsRef.current || !connected) return;

    log('INFO', 'REFRESH', 'Refreshing products');
    hasFetchedRef.current = false;
    setProductsFetched(false);
    setState('fetching');
    setDebugInfo('Ricaricamento prodotti...');

    try {
      const { getSubscriptions } = iapFunctionsRef.current;
      const subs = await getSubscriptions({ skus: ACTIVE_SUBSCRIPTION_SKUS });
      
      if (subs && subs.length > 0) {
        setSubscriptions(subs);
        setProductsFetched(true);
        setState('ready');
        setError(null);
        setDebugInfo(`${subs.length} prodotto/i caricato/i`);
      } else {
        setIAPError('NO_PRODUCTS', 'Nessun prodotto trovato', 'REFRESH');
      }
    } catch (err: any) {
      setIAPError('REFRESH_ERROR', err.message || 'Errore ricaricamento', 'REFRESH');
    }
  }, [connected]);

  // Retry connection
  const retryConnection = useCallback(() => {
    log('INFO', 'RETRY', 'Retrying connection');
    hasFetchedRef.current = false;
    setProductsFetched(false);
    setSubscriptions([]);
    setConnected(false);
    setState('initializing');
    setError(null);
    setDebugInfo('Riconnessione...');
    
    // Force reload module
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
    isReady: state === 'ready' && subscriptions.length > 0,
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
// MAIN EXPORT - Chooses web or native implementation
// ============================================================================

export function useSubscription(): UseSubscriptionResult {
  // On web, return fallback immediately
  if (Platform.OS === 'web') {
    return useSubscriptionFallback('IAP non disponibile (web) - Usa Stripe');
  }
  
  // Check if running in Expo Go (doesn't support custom native modules)
  if (isExpoGo()) {
    return useSubscriptionFallback('IAP non disponibile in Expo Go. Serve una build nativa (TestFlight o Development Build).');
  }
  
  // Check if native module is actually available
  if (!isNativeIAPModuleAvailable()) {
    return useSubscriptionFallback('Modulo nativo ExpoIap non trovato. Serve una build nativa con expo-iap.');
  }
  
  // On native platforms with module available, use the full IAP implementation
  return useSubscriptionNative();
}
