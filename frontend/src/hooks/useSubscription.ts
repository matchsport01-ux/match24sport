// useSubscription.ts - Hook for native iOS StoreKit and Android Google Play Billing
// Uses expo-iap's useIAP hook correctly with the proper API
import { useEffect, useState, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import { useIAP } from 'expo-iap';
import type { Purchase, ProductSubscription } from 'expo-iap';
import { apiClient } from '../api/client';

// Product IDs that must match App Store Connect and Google Play Console
export const PRODUCT_IDS = {
  MONTHLY: 'com.matchsport24.subscription.monthly',
  YEARLY: 'com.matchsport24.subscription.yearly',
};

// Only the monthly SKU for now (yearly not configured in App Store Connect yet)
export const ACTIVE_SUBSCRIPTION_SKUS = [PRODUCT_IDS.MONTHLY];

// Check if we should use native IAP (only on iOS/Android, not web)
export function shouldUseNativeIAP(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export interface UseSubscriptionResult {
  isConnected: boolean;
  isLoading: boolean;
  isPurchasing: boolean;
  isRestoring: boolean;
  products: ProductSubscription[];
  error: string | null;
  purchaseSubscription: (productId: string) => Promise<{ success: boolean; error?: string }>;
  restorePurchases: () => Promise<{ success: boolean; message?: string }>;
  refreshProducts: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionResult {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingValidation, setPendingValidation] = useState<Purchase | null>(null);

  // Only use IAP hook on mobile platforms
  const iapEnabled = shouldUseNativeIAP();

  // Use the expo-iap hook with proper callbacks
  const {
    connected,
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    restorePurchases: iapRestorePurchases,
    availablePurchases,
  } = useIAP(iapEnabled ? {
    onPurchaseSuccess: async (purchase: Purchase) => {
      console.log('[useSubscription] Purchase success callback:', purchase);
      setPendingValidation(purchase);
    },
    onPurchaseError: (err) => {
      console.error('[useSubscription] Purchase error callback:', err);
      // Check if user cancelled
      if (err.code === 'user-cancelled' || err.message?.toLowerCase().includes('cancel')) {
        setError(null);
      } else {
        setError(err.message || 'Errore durante l\'acquisto');
      }
      setIsPurchasing(false);
    },
    onError: (err) => {
      console.error('[useSubscription] General error:', err);
    },
  } : undefined);

  // Fetch subscription products when connected
  useEffect(() => {
    if (iapEnabled && connected) {
      console.log('[useSubscription] Connected, fetching subscriptions...');
      fetchProducts({
        skus: ACTIVE_SUBSCRIPTION_SKUS,
        type: 'subs', // Important: 'subs' for subscriptions
      }).then(() => {
        console.log('[useSubscription] Subscriptions fetched');
      }).catch((err) => {
        console.error('[useSubscription] Failed to fetch subscriptions:', err);
        setError('Impossibile caricare i prodotti');
      });
    }
  }, [connected, iapEnabled]);

  // Handle pending validation when purchase succeeds
  useEffect(() => {
    if (pendingValidation && isPurchasing) {
      validatePurchaseWithBackend(pendingValidation);
    }
  }, [pendingValidation, isPurchasing]);

  const validatePurchaseWithBackend = async (purchase: Purchase) => {
    try {
      console.log('[useSubscription] Validating purchase with backend:', purchase);
      
      // Extract receipt/token based on platform
      const receipt = Platform.OS === 'ios' 
        ? (purchase as any).transactionReceipt || (purchase as any).jws
        : (purchase as any).purchaseToken;
      
      const transactionId = purchase.transactionId || (purchase as any).purchaseToken || purchase.id;
      const productId = purchase.productId || purchase.id;

      // Validate with backend
      const validation = await apiClient.validateIAPPurchase({
        platform: Platform.OS as 'ios' | 'android',
        product_id: productId,
        transaction_id: transactionId,
        receipt: receipt || '',
        plan_id: productId.includes('yearly') ? 'yearly' : 'monthly',
      });

      if (validation.success) {
        console.log('[useSubscription] Backend validation successful');
        
        // Finish the transaction after successful validation
        try {
          await finishTransaction({
            purchase,
            isConsumable: false, // Subscriptions are non-consumable
          });
          console.log('[useSubscription] Transaction finished');
        } catch (finishErr) {
          console.log('[useSubscription] Finish transaction note:', finishErr);
        }
        
        setError(null);
      } else {
        console.error('[useSubscription] Backend validation failed:', validation);
        setError(validation.message || 'Validazione fallita');
      }
    } catch (err: any) {
      console.error('[useSubscription] Validation error:', err);
      setError(err.message || 'Errore di validazione');
    } finally {
      setIsPurchasing(false);
      setPendingValidation(null);
    }
  };

  const purchaseSubscription = useCallback(async (productId: string): Promise<{ success: boolean; error?: string }> => {
    if (!iapEnabled) {
      return { success: false, error: 'IAP non disponibile su questa piattaforma' };
    }

    if (!connected) {
      return { success: false, error: 'Store non connesso' };
    }

    setIsPurchasing(true);
    setError(null);
    setPendingValidation(null);

    try {
      console.log('[useSubscription] Starting purchase for:', productId);
      
      // Find the subscription offer for Android
      let offerToken: string | undefined;
      if (Platform.OS === 'android') {
        const subscription = subscriptions.find(s => s.id === productId);
        if (subscription && 'subscriptionOfferDetailsAndroid' in subscription) {
          const offers = (subscription as any).subscriptionOfferDetailsAndroid;
          if (offers && offers.length > 0) {
            offerToken = offers[0].offerToken;
          }
        }
      }

      // Request the subscription purchase with correct API format
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

      console.log('[useSubscription] Purchase request result:', result);

      // If result is returned directly (not via callback), handle it
      if (result) {
        const purchase = Array.isArray(result) ? result[0] : result;
        if (purchase) {
          setPendingValidation(purchase);
          return { success: true };
        }
      }

      // Purchase might be handled asynchronously via callback
      // Return success as the callback will handle the actual result
      return new Promise((resolve) => {
        // Set a timeout for the purchase (2 minutes)
        const timeout = setTimeout(() => {
          setIsPurchasing(false);
          resolve({ success: false, error: 'Timeout durante l\'acquisto' });
        }, 120000);

        // Check periodically if purchase was validated
        const checkInterval = setInterval(() => {
          if (!isPurchasing || pendingValidation) {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            resolve({ success: true });
          }
        }, 1000);
      });
    } catch (err: any) {
      console.error('[useSubscription] Purchase request error:', err);
      
      // Check for user cancellation
      const errorMsg = err.message || err.toString() || '';
      if (errorMsg.toLowerCase().includes('cancel') || 
          err.code === 'user-cancelled' ||
          err.code === 'E_USER_CANCELLED') {
        setIsPurchasing(false);
        return { success: false, error: 'cancelled' };
      }
      
      // Check for already owned
      if (errorMsg.includes('already') || err.code === 'already-owned') {
        setIsPurchasing(false);
        return { success: false, error: 'Hai già un abbonamento attivo' };
      }
      
      setError(errorMsg || 'Errore durante l\'acquisto');
      setIsPurchasing(false);
      return { success: false, error: errorMsg || 'Errore durante l\'acquisto' };
    }
  }, [iapEnabled, connected, requestPurchase, subscriptions, isPurchasing, pendingValidation]);

  const restorePurchases = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    if (!iapEnabled) {
      return { success: false, message: 'IAP non disponibile su questa piattaforma' };
    }

    if (!connected) {
      return { success: false, message: 'Store non connesso' };
    }

    setIsRestoring(true);
    setError(null);

    try {
      console.log('[useSubscription] Restoring purchases...');
      
      // Use expo-iap's restore function
      await iapRestorePurchases();
      
      console.log('[useSubscription] Available purchases after restore:', availablePurchases);

      if (availablePurchases && availablePurchases.length > 0) {
        // Find subscription purchase
        const subscriptionPurchase = availablePurchases.find((p: Purchase) => 
          p.productId?.includes('subscription') || 
          ACTIVE_SUBSCRIPTION_SKUS.includes(p.productId || '')
        );

        if (subscriptionPurchase) {
          // Validate with backend
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
            setIsRestoring(false);
            return { success: true, message: 'Abbonamento ripristinato con successo!' };
          }
        }
      }

      // Try backend restore as fallback
      try {
        const backendRestore = await apiClient.restoreIAPPurchases();
        setIsRestoring(false);
        
        if (backendRestore.success) {
          return { success: true, message: backendRestore.message || 'Abbonamento ripristinato!' };
        }
      } catch (backendErr) {
        console.log('[useSubscription] Backend restore fallback failed:', backendErr);
      }
      
      setIsRestoring(false);
      return { success: false, message: 'Nessun abbonamento da ripristinare' };
    } catch (err: any) {
      console.error('[useSubscription] Restore error:', err);
      setIsRestoring(false);
      setError(err.message || 'Errore nel ripristino');
      return { success: false, message: err.message || 'Errore nel ripristino' };
    }
  }, [iapEnabled, connected, iapRestorePurchases, availablePurchases]);

  const refreshProducts = useCallback(async () => {
    if (iapEnabled && connected) {
      try {
        await fetchProducts({
          skus: ACTIVE_SUBSCRIPTION_SKUS,
          type: 'subs',
        });
      } catch (err) {
        console.error('[useSubscription] Refresh products error:', err);
      }
    }
  }, [iapEnabled, connected, fetchProducts]);

  // For web, return mock state that indicates to use Stripe
  if (!iapEnabled) {
    return {
      isConnected: false,
      isLoading: false,
      isPurchasing: false,
      isRestoring: false,
      products: [],
      error: null,
      purchaseSubscription: async () => ({ success: false, error: 'Use Stripe on web' }),
      restorePurchases: async () => ({ success: false, message: 'Not available on web' }),
      refreshProducts: async () => {},
    };
  }

  return {
    isConnected: connected,
    isLoading: !connected && iapEnabled,
    isPurchasing,
    isRestoring,
    products: subscriptions || [],
    error,
    purchaseSubscription,
    restorePurchases,
    refreshProducts,
  };
}
