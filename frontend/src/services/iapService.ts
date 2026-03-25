// In-App Purchases Service for iOS StoreKit and Android Google Play Billing
// Apple Guideline compliant - uses native store billing for mobile apps
import { Platform } from 'react-native';
import * as ExpoIAP from 'expo-iap';

// Product IDs that must match App Store Connect and Google Play Console
export const PRODUCT_IDS = {
  MONTHLY: Platform.select({
    ios: 'com.matchsport24.subscription.monthly',
    android: 'com.matchsport24.subscription.monthly',
    default: 'monthly',
  }),
  YEARLY: Platform.select({
    ios: 'com.matchsport24.subscription.yearly',
    android: 'com.matchsport24.subscription.yearly',
    default: 'yearly',
  }),
};

// Map frontend plan IDs to store product IDs
export const PLAN_TO_PRODUCT_ID: Record<string, string> = {
  monthly: PRODUCT_IDS.MONTHLY!,
  yearly: PRODUCT_IDS.YEARLY!,
};

// Plan prices (fallback if store prices unavailable)
export const PLAN_PRICES = {
  monthly: { price: 49.99, currency: 'EUR' },
  yearly: { price: 399.99, currency: 'EUR' },
};

export interface SubscriptionProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  priceAmount: number;
  currency: string;
  localizedPrice: string;
  subscriptionPeriod?: string;
}

export interface PurchaseResult {
  success: boolean;
  transactionId?: string;
  productId?: string;
  receipt?: string;
  error?: string;
  cancelled?: boolean;
}

class InAppPurchaseService {
  private isConnected: boolean = false;
  private products: Map<string, SubscriptionProduct> = new Map();
  private purchaseUpdateSubscription: any = null;
  private purchaseErrorSubscription: any = null;

  // Check if IAP is available on this platform
  isIAPAvailable(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }

  // Initialize the IAP connection
  async initialize(): Promise<boolean> {
    if (!this.isIAPAvailable()) {
      console.log('[IAP] Not available on this platform');
      return false;
    }

    try {
      const result = await ExpoIAP.initConnection();
      this.isConnected = !!result;
      console.log('[IAP] Connection initialized:', result);
      
      // On Android, consume any pending purchases to clear the queue
      if (Platform.OS === 'android') {
        await ExpoIAP.flushFailedPurchasesCachedAsPendingAndroid();
      }
      
      return this.isConnected;
    } catch (error) {
      console.error('[IAP] Failed to initialize:', error);
      this.isConnected = false;
      return false;
    }
  }

  // Disconnect IAP when done
  async disconnect(): Promise<void> {
    if (this.isConnected) {
      try {
        await ExpoIAP.endConnection();
        this.isConnected = false;
        console.log('[IAP] Disconnected');
      } catch (error) {
        console.error('[IAP] Error disconnecting:', error);
      }
    }
  }

  // Fetch products from the store
  async getProducts(): Promise<SubscriptionProduct[]> {
    if (!this.isConnected) {
      const initialized = await this.initialize();
      if (!initialized) {
        console.log('[IAP] Cannot fetch products - not connected');
        return [];
      }
    }

    try {
      const productIds = Object.values(PRODUCT_IDS).filter(Boolean) as string[];
      console.log('[IAP] Fetching products:', productIds);
      
      // For subscriptions, use getSubscriptions
      const subscriptions = await ExpoIAP.getSubscriptions({ skus: productIds });
      console.log('[IAP] Subscriptions fetched:', subscriptions);
      
      const products: SubscriptionProduct[] = subscriptions.map((sub: any) => ({
        productId: sub.productId,
        title: sub.title || sub.name || 'Subscription',
        description: sub.description || '',
        price: sub.price || sub.localizedPrice || '€49.99',
        priceAmount: parseFloat(sub.price?.replace(/[^0-9.,]/g, '').replace(',', '.') || '49.99'),
        currency: sub.currency || 'EUR',
        localizedPrice: sub.localizedPrice || sub.price || '€49.99',
        subscriptionPeriod: sub.subscriptionPeriodAndroid || sub.subscriptionPeriodIOS || 'P1M',
      }));

      // Cache the products
      products.forEach(p => this.products.set(p.productId, p));
      
      return products;
    } catch (error) {
      console.error('[IAP] Error fetching products:', error);
      return [];
    }
  }

  // Get a specific product
  getProduct(productId: string): SubscriptionProduct | undefined {
    return this.products.get(productId);
  }

  // Get product by plan ID
  getProductByPlan(planId: 'monthly' | 'yearly'): SubscriptionProduct | undefined {
    const productId = PLAN_TO_PRODUCT_ID[planId];
    return productId ? this.products.get(productId) : undefined;
  }

  // Purchase a subscription
  async purchaseSubscription(productId: string): Promise<PurchaseResult> {
    if (!this.isConnected) {
      const initialized = await this.initialize();
      if (!initialized) {
        return { success: false, error: 'Store non disponibile' };
      }
    }

    try {
      console.log('[IAP] Starting purchase for:', productId);
      
      // Request the purchase
      const purchase = await ExpoIAP.requestSubscription({ 
        sku: productId,
        // For Android, you can specify offer tokens if using subscription offers
        ...(Platform.OS === 'android' && {
          subscriptionOffers: [{ sku: productId, offerToken: '' }]
        })
      });

      console.log('[IAP] Purchase result:', purchase);

      if (purchase && purchase.length > 0) {
        const transaction = purchase[0];
        
        // Acknowledge/Finish the purchase
        if (Platform.OS === 'android' && !transaction.isAcknowledgedAndroid) {
          await ExpoIAP.acknowledgePurchaseAndroid({ token: transaction.purchaseToken! });
        } else if (Platform.OS === 'ios') {
          await ExpoIAP.finishTransaction({ purchase: transaction });
        }

        return {
          success: true,
          transactionId: transaction.transactionId || transaction.purchaseToken,
          productId: transaction.productId,
          receipt: Platform.OS === 'ios' 
            ? transaction.transactionReceipt 
            : transaction.purchaseToken,
        };
      }

      return { success: false, error: 'Acquisto non completato' };
    } catch (error: any) {
      console.error('[IAP] Purchase error:', error);
      
      // Check if user cancelled
      if (error.code === 'E_USER_CANCELLED' || 
          error.message?.includes('cancelled') ||
          error.message?.includes('canceled')) {
        return { success: false, cancelled: true, error: 'Acquisto annullato' };
      }

      // Check for already owned (for non-consumables)
      if (error.code === 'E_ALREADY_OWNED') {
        return { success: false, error: 'Hai già un abbonamento attivo' };
      }

      return { 
        success: false, 
        error: error.message || 'Errore durante l\'acquisto' 
      };
    }
  }

  // Purchase by plan ID
  async purchaseByPlan(planId: 'monthly' | 'yearly'): Promise<PurchaseResult> {
    const productId = PLAN_TO_PRODUCT_ID[planId];
    if (!productId) {
      return { success: false, error: 'Piano non trovato' };
    }
    return this.purchaseSubscription(productId);
  }

  // Restore purchases
  async restorePurchases(): Promise<PurchaseResult[]> {
    if (!this.isConnected) {
      const initialized = await this.initialize();
      if (!initialized) {
        return [{ success: false, error: 'Store non disponibile' }];
      }
    }

    try {
      console.log('[IAP] Restoring purchases...');
      
      const purchases = await ExpoIAP.getAvailablePurchases();
      console.log('[IAP] Restored purchases:', purchases);

      if (purchases && purchases.length > 0) {
        return purchases.map((p: any) => ({
          success: true,
          transactionId: p.transactionId || p.purchaseToken,
          productId: p.productId,
          receipt: Platform.OS === 'ios' 
            ? p.transactionReceipt 
            : p.purchaseToken,
        }));
      }

      return [{ success: false, error: 'Nessun acquisto da ripristinare' }];
    } catch (error: any) {
      console.error('[IAP] Restore error:', error);
      return [{ success: false, error: error.message || 'Errore nel ripristino' }];
    }
  }

  // Check current subscription status
  async getCurrentSubscription(): Promise<{ isActive: boolean; productId?: string; expiresAt?: Date }> {
    try {
      const purchases = await ExpoIAP.getAvailablePurchases();
      
      if (purchases && purchases.length > 0) {
        // Find the most recent subscription
        const subscription = purchases.find((p: any) => 
          p.productId?.includes('subscription')
        );
        
        if (subscription) {
          return {
            isActive: true,
            productId: subscription.productId,
            expiresAt: subscription.transactionDate 
              ? new Date(subscription.transactionDate) 
              : undefined,
          };
        }
      }

      return { isActive: false };
    } catch (error) {
      console.error('[IAP] Error checking subscription:', error);
      return { isActive: false };
    }
  }

  // Set up purchase listeners
  setupPurchaseListeners(
    onPurchaseUpdate: (purchase: any) => void,
    onPurchaseError: (error: any) => void
  ): void {
    // Note: expo-iap handles listeners internally
    // These callbacks would be used with the event emitter if available
    console.log('[IAP] Purchase listeners set up');
  }

  // Remove purchase listeners
  removePurchaseListeners(): void {
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
      this.purchaseUpdateSubscription = null;
    }
    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
      this.purchaseErrorSubscription = null;
    }
  }
}

// Singleton instance
export const iapService = new InAppPurchaseService();

// Helper function to determine if we should use native IAP
export function shouldUseNativeIAP(): boolean {
  // Use native IAP on iOS and Android when running on device
  // For web or development, fall back to Stripe
  if (Platform.OS === 'web') {
    return false;
  }
  
  // Check if this is a store build (not Expo Go)
  // In production builds, __DEV__ is false
  if (__DEV__) {
    // In development, you can test IAP with sandbox accounts
    // but for Expo Go, IAP is not available
    return false; // Return false for Expo Go testing
  }
  
  return true;
}
