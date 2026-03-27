// Club Subscription Screen - Apple App Store Compliant
// Handles native IAP with comprehensive state management, iPad support, and legal compliance
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
  TextInput,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, LoadingSpinner } from '../../src/components';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { COLORS } from '../../src/utils/constants';
import { apiClient } from '../../src/api/client';
import { format, parseISO } from 'date-fns';
import { useSubscription, shouldUseNativeIAP, PRODUCT_IDS, ACTIVE_SUBSCRIPTION_SKUS } from '../../src/hooks/useSubscription';
import { successHaptic, errorHaptic } from '../../src/utils/haptics';

// Legal URLs - REQUIRED for Apple compliance
const LEGAL_URLS = {
  PRIVACY_POLICY: 'https://padel-finder-app.emergent.host/privacy',
  TERMS_OF_USE: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
};

// Get responsive dimensions for iPad support
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isTablet = SCREEN_WIDTH >= 768;

export default function ClubSubscriptionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const session_id = String(params.session_id || '');
  const { t } = useLanguage();

  const [club, setClub] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoType, setPromoType] = useState<'percentage' | 'trial_months' | null>(null);
  const [promoValue, setPromoValue] = useState(0);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // Debug mode - only in development
  const [showDebug, setShowDebug] = useState(__DEV__);

  // Use the subscription hook with comprehensive error handling
  const {
    state: iapState,
    isConnected: iapConnected,
    isLoading: iapLoading,
    isPurchasing,
    isRestoring,
    isReady: iapReady,
    products: iapProducts,
    error: iapError,
    debugInfo,
    purchaseSubscription,
    restorePurchases,
    refreshProducts,
    retryConnection,
  } = useSubscription();

  // Plan configuration - Price MUST match App Store Connect (49.99 USD)
  const plans = {
    monthly: {
      name: 'Mensile',
      price: 49.99,
      currency: 'USD',
      period: '/mese',
      periodDescription: '1 mese',
      productId: PRODUCT_IDS.MONTHLY,
    },
  };

  // Get price from store products with fallback
  const getStorePrice = useCallback((productId: string): string => {
    if (iapProducts && iapProducts.length > 0) {
      const product = iapProducts.find((p: any) => 
        p.id === productId || p.productId === productId
      );
      if (product) {
        return (product as any).displayPrice || 
               (product as any).localizedPrice || 
               `$${plans.monthly.price.toFixed(2)}`;
      }
    }
    return `$${plans.monthly.price.toFixed(2)}`;
  }, [iapProducts]);

  // Validate promo code
  const validatePromoCode = async () => {
    if (!promoCode.trim()) {
      Alert.alert('Errore', 'Inserisci un codice promozionale');
      return;
    }

    setIsValidatingPromo(true);
    try {
      const response = await apiClient.validatePromoCode(promoCode.trim().toUpperCase());
      if (response.valid) {
        setPromoApplied(true);
        setPromoDiscount(response.discount || 0);
        setPromoType(response.type || 'percentage');
        setPromoValue(response.value || 0);
        Alert.alert('Successo', response.message);
      } else {
        Alert.alert('Errore', response.message || 'Codice non valido');
      }
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.message || 'Codice promozionale non valido');
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const removePromoCode = () => {
    setPromoCode('');
    setPromoApplied(false);
    setPromoDiscount(0);
    setPromoType(null);
    setPromoValue(0);
  };

  const getDiscountedPrice = (originalPrice: number) => {
    if (!promoApplied || promoDiscount === 0) return originalPrice;
    return originalPrice * (1 - promoDiscount / 100);
  };

  // Fetch club data
  const fetchClub = async () => {
    try {
      const data = await apiClient.getMyClub();
      setClub(data);
    } catch (error) {
      // Silent fail - club data is optional for subscription view
    } finally {
      setIsLoading(false);
    }
  };

  // Check Stripe payment status (web only)
  const checkPaymentStatus = async (sessionId: string) => {
    setIsProcessing(true);
    let attempts = 0;
    const maxAttempts = 5;
    const pollInterval = 2000;

    const poll = async () => {
      try {
        const status = await apiClient.getSubscriptionStatus(sessionId);
        if (status.payment_status === 'paid') {
          Alert.alert('Successo', 'Abbonamento attivato con successo!');
          await fetchClub();
          setIsProcessing(false);
          if (Platform.OS === 'web') {
            window.history.replaceState(null, '', window.location.pathname);
          }
          return;
        }
        if (status.status === 'expired') {
          Alert.alert('Errore', 'La sessione di pagamento è scaduta');
          setIsProcessing(false);
          return;
        }
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, pollInterval);
        } else {
          setIsProcessing(false);
        }
      } catch (error) {
        setIsProcessing(false);
      }
    };

    poll();
  };

  useEffect(() => {
    fetchClub();
  }, []);

  useEffect(() => {
    if (session_id) {
      checkPaymentStatus(session_id);
    }
  }, [session_id]);

  // Auto-retry for IAP connection issues (max 3 times)
  useEffect(() => {
    if (iapState === 'error' && retryCount < 3 && shouldUseNativeIAP()) {
      const timer = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        retryConnection();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [iapState, retryCount]);

  // Handle native IAP purchase
  const handleIAPPurchase = async () => {
    const plan = plans[selectedPlan];
    if (!plan?.productId) {
      Alert.alert('Errore', 'Piano non disponibile');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await purchaseSubscription(plan.productId);

      if (result.error === 'cancelled') {
        setIsProcessing(false);
        return;
      }

      if (!result.success) {
        errorHaptic();
        Alert.alert('Errore', result.error || 'Acquisto non completato');
        setIsProcessing(false);
        return;
      }

      successHaptic();
      Alert.alert('Successo!', 'Abbonamento attivato con successo!');
      await fetchClub();
    } catch (error: any) {
      errorHaptic();
      Alert.alert('Errore', error.message || "Errore durante l'acquisto");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Stripe checkout (web)
  const handleStripeCheckout = async () => {
    setIsProcessing(true);
    try {
      const originUrl = Platform.OS === 'web'
        ? window.location.origin
        : 'https://padel-finder-app.preview.emergentagent.com';

      const result = await apiClient.createSubscriptionCheckout(selectedPlan, originUrl);

      if (result.url) {
        if (Platform.OS === 'web') {
          window.location.href = result.url;
        } else {
          await Linking.openURL(result.url);
        }
      }
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Impossibile avviare il pagamento');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle restore purchases
  const handleRestorePurchases = async () => {
    try {
      const result = await restorePurchases();

      if (result.success) {
        successHaptic();
        Alert.alert('Successo!', result.message || 'Abbonamento ripristinato!');
        await fetchClub();
      } else {
        Alert.alert('Info', result.message || 'Nessun abbonamento da ripristinare');
      }
    } catch (error: any) {
      Alert.alert('Errore', 'Impossibile ripristinare gli acquisti');
    }
  };

  // Main subscribe handler
  const handleSubscribe = async () => {
    if (promoApplied && promoType === 'trial_months') {
      setIsProcessing(true);
      try {
        const result = await apiClient.applyTrialPromo(promoCode.trim().toUpperCase());
        if (result.success) {
          Alert.alert('Successo', result.message);
          await fetchClub();
          removePromoCode();
        }
      } catch (error: any) {
        Alert.alert('Errore', error.response?.data?.detail || 'Impossibile attivare la prova');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    if (shouldUseNativeIAP()) {
      await handleIAPPurchase();
    } else {
      await handleStripeCheckout();
    }
  };

  // Open legal URLs
  const openPrivacyPolicy = () => Linking.openURL(LEGAL_URLS.PRIVACY_POLICY);
  const openTermsOfUse = () => Linking.openURL(LEGAL_URLS.TERMS_OF_USE);

  // Status helpers
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return COLORS.success;
      case 'trial': return COLORS.warning;
      case 'expired': return COLORS.error;
      default: return COLORS.textMuted;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Attivo';
      case 'trial': return 'Prova';
      case 'expired': return 'Scaduto';
      default: return status;
    }
  };

  const getPaymentMethodLabel = () => {
    if (shouldUseNativeIAP()) {
      return Platform.OS === 'ios' ? 'App Store' : 'Google Play';
    }
    return 'Stripe';
  };

  // Determine button state
  const isIAPMode = shouldUseNativeIAP();
  const isIAPLoading = isIAPMode && (iapState === 'initializing' || iapState === 'connecting' || iapState === 'fetching');
  const isIAPError = isIAPMode && iapState === 'error';
  const hasProducts = !isIAPMode || (iapProducts && iapProducts.length > 0);
  
  const canSubscribe = isIAPMode
    ? (iapReady && hasProducts && !isPurchasing && !isProcessing)
    : !isProcessing;

  // Render loading state
  if (isLoading) {
    return <LoadingSpinner fullScreen message="Caricamento..." />;
  }

  // Render IAP loading/error state - Apple compliant UI
  const renderIAPState = () => {
    if (!isIAPMode) return null;

    // Loading state
    if (isIAPLoading) {
      return (
        <Card style={styles.stateCard}>
          <View style={styles.stateContent}>
            <ActivityIndicator size="small" color={COLORS.accent} />
            <Text style={styles.stateText}>Connessione allo store in corso...</Text>
          </View>
        </Card>
      );
    }

    // Error state with retry
    if (isIAPError) {
      return (
        <Card style={[styles.stateCard, styles.errorCard]}>
          <View style={styles.stateContent}>
            <Ionicons name="alert-circle" size={24} color={COLORS.error} />
            <View style={styles.stateTextContainer}>
              <Text style={styles.errorTitle}>Impossibile caricare i prodotti</Text>
              <Text style={styles.errorMessage}>
                Verifica la connessione internet e riprova
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => {
              setRetryCount(0);
              retryConnection();
            }}
          >
            <Ionicons name="refresh" size={20} color={COLORS.accent} />
            <Text style={styles.retryText}>Riprova</Text>
          </TouchableOpacity>
        </Card>
      );
    }

    // Empty products state
    if (iapReady && !hasProducts) {
      return (
        <Card style={[styles.stateCard, styles.warningCard]}>
          <View style={styles.stateContent}>
            <Ionicons name="information-circle" size={24} color={COLORS.warning} />
            <View style={styles.stateTextContainer}>
              <Text style={styles.warningTitle}>Abbonamento temporaneamente non disponibile</Text>
              <Text style={styles.warningMessage}>
                Riprova tra qualche minuto
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.retryButton} onPress={refreshProducts}>
            <Ionicons name="refresh" size={20} color={COLORS.accent} />
            <Text style={styles.retryText}>Aggiorna</Text>
          </TouchableOpacity>
        </Card>
      );
    }

    return null;
  };

  // Render debug info (only in dev mode)
  const renderDebug = () => {
    if (!showDebug || !__DEV__) return null;

    return (
      <Card style={styles.debugCard}>
        <Text style={styles.debugTitle}>Debug IAP</Text>
        <Text style={styles.debugText}>State: {iapState}</Text>
        <Text style={styles.debugText}>Connected: {iapConnected ? 'Yes' : 'No'}</Text>
        <Text style={styles.debugText}>Products: {iapProducts?.length || 0}</Text>
        <Text style={styles.debugText}>SKUs: {ACTIVE_SUBSCRIPTION_SKUS.join(', ')}</Text>
        {iapError && (
          <Text style={[styles.debugText, { color: COLORS.error }]}>
            Error: {iapError.code} - {iapError.message}
          </Text>
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Abbonamento</Text>
        {__DEV__ && (
          <TouchableOpacity onPress={() => setShowDebug(!showDebug)}>
            <Ionicons name="bug-outline" size={24} color={showDebug ? COLORS.accent : COLORS.textMuted} />
          </TouchableOpacity>
        )}
        {!__DEV__ && <View style={{ width: 24 }} />}
      </View>

      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && styles.scrollContentTablet
        ]} 
        showsVerticalScrollIndicator={false}
      >
        {/* Debug Info */}
        {renderDebug()}

        {/* IAP State (Loading/Error/Empty) */}
        {renderIAPState()}

        {/* Current Status */}
        {club && (
          <Card style={styles.statusCard}>
            <Text style={styles.statusLabel}>Stato attuale</Text>
            <View style={styles.statusRow}>
              <View style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(club.subscription_status) + '20' }
              ]}>
                <View style={[
                  styles.statusDot,
                  { backgroundColor: getStatusColor(club.subscription_status) }
                ]} />
                <Text style={[
                  styles.statusText,
                  { color: getStatusColor(club.subscription_status) }
                ]}>
                  {getStatusLabel(club.subscription_status)}
                </Text>
              </View>
            </View>
            {club.subscription_expires_at && (
              <Text style={styles.expiresText}>
                {club.subscription_status === 'active' ? 'Scade il' : 'Scaduto il'}:{' '}
                {format(parseISO(club.subscription_expires_at), 'dd/MM/yyyy')}
              </Text>
            )}
          </Card>
        )}

        {/* Plan Selection */}
        <Text style={styles.sectionTitle}>Piano Premium</Text>

        {Object.entries(plans).map(([planId, plan]) => {
          const displayPrice = getStorePrice(plan.productId);

          return (
            <TouchableOpacity
              key={planId}
              onPress={() => setSelectedPlan(planId as 'monthly')}
              activeOpacity={0.7}
            >
              <Card style={[
                styles.planCard,
                selectedPlan === planId && styles.planCardSelected,
              ]}>
                <View style={styles.planHeader}>
                  <View style={[
                    styles.radioOuter,
                    selectedPlan === planId && styles.radioOuterSelected,
                  ]}>
                    {selectedPlan === planId && <View style={styles.radioInner} />}
                  </View>
                  <View style={styles.planInfo}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Text style={styles.planDescription}>
                      Accesso completo alla piattaforma
                    </Text>
                  </View>
                  <View style={styles.planPrice}>
                    {promoApplied && promoDiscount > 0 && (
                      <Text style={styles.originalPrice}>${plan.price.toFixed(2)}</Text>
                    )}
                    <Text style={styles.priceValue}>{displayPrice}</Text>
                    <Text style={styles.pricePeriod}>{plan.period}</Text>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}

        {/* APPLE COMPLIANCE: Subscription Info Section - REQUIRED */}
        <Card style={styles.subscriptionInfoCard}>
          <Text style={styles.subscriptionInfoTitle}>Dettagli Abbonamento</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nome:</Text>
            <Text style={styles.infoValue}>Abbonamento Mensile</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Durata:</Text>
            <Text style={styles.infoValue}>1 mese</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Prezzo:</Text>
            <Text style={styles.infoValue}>{getStorePrice(PRODUCT_IDS.MONTHLY)}</Text>
          </View>

          <View style={styles.autoRenewContainer}>
            <Ionicons name="refresh-circle" size={20} color={COLORS.warning} />
            <Text style={styles.autoRenewText}>
              L'abbonamento si rinnova automaticamente ogni mese. 
              Puoi annullarlo in qualsiasi momento dalle impostazioni del tuo account {Platform.OS === 'ios' ? 'App Store' : 'Google Play'}.
            </Text>
          </View>
        </Card>

        {/* Promo Code (Web only) */}
        {!shouldUseNativeIAP() && (
          <Card style={styles.promoCard}>
            <View style={styles.promoHeader}>
              <Ionicons name="pricetag-outline" size={20} color={COLORS.accent} />
              <Text style={styles.promoTitle}>Codice Promozionale</Text>
            </View>
            {promoApplied ? (
              <View style={styles.promoAppliedContainer}>
                <View style={styles.promoAppliedBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                  <Text style={styles.promoAppliedText}>
                    {promoType === 'trial_months'
                      ? `${promoValue} mesi di prova gratuita`
                      : `Sconto ${promoDiscount}% applicato`}
                  </Text>
                </View>
                <TouchableOpacity onPress={removePromoCode} style={styles.removePromoButton}>
                  <Ionicons name="close-circle" size={24} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.promoInputContainer}>
                <TextInput
                  style={styles.promoInput}
                  placeholder="Inserisci codice"
                  placeholderTextColor={COLORS.textMuted}
                  value={promoCode}
                  onChangeText={setPromoCode}
                  autoCapitalize="characters"
                />
                <TouchableOpacity
                  style={styles.promoButton}
                  onPress={validatePromoCode}
                  disabled={isValidatingPromo}
                >
                  {isValidatingPromo ? (
                    <ActivityIndicator size="small" color={COLORS.text} />
                  ) : (
                    <Text style={styles.promoButtonText}>Applica</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </Card>
        )}

        {/* Features List */}
        <Card style={styles.featuresCard}>
          <Text style={styles.featuresTitle}>Cosa include:</Text>
          {[
            'Profilo circolo personalizzato',
            'Gestione illimitata campi',
            'Pubblicazione partite',
            'Ricezione prenotazioni',
            'Dashboard statistiche',
            'Supporto prioritario',
          ].map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </Card>

        {/* Subscribe Button */}
        <Button
          title={
            isIAPLoading ? 'Caricamento...' :
            isIAPError ? 'Non disponibile' :
            promoApplied && promoType === 'trial_months' ? `Attiva prova ${promoValue} mesi` :
            club?.subscription_status === 'active' ? 'Cambia piano' : 'Abbonati ora'
          }
          onPress={handleSubscribe}
          loading={isProcessing || isPurchasing}
          disabled={!canSubscribe || isIAPLoading || isIAPError}
          fullWidth
          size="large"
          style={styles.subscribeButton}
        />

        {/* Restore Purchases (Mobile only) */}
        {shouldUseNativeIAP() && (
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestorePurchases}
            disabled={isRestoring || !iapConnected}
          >
            <Text style={styles.restoreButtonText}>
              {isRestoring ? 'Ripristino in corso...' : 'Ripristina acquisti'}
            </Text>
          </TouchableOpacity>
        )}

        {/* APPLE COMPLIANCE: Legal Links - REQUIRED */}
        <View style={styles.legalSection}>
          <Text style={styles.legalTitle}>Termini e condizioni</Text>
          <View style={styles.legalLinks}>
            <TouchableOpacity onPress={openPrivacyPolicy} style={styles.legalLink}>
              <Ionicons name="document-text-outline" size={16} color={COLORS.accent} />
              <Text style={styles.legalLinkText}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={styles.legalSeparator}>•</Text>
            <TouchableOpacity onPress={openTermsOfUse} style={styles.legalLink}>
              <Ionicons name="document-text-outline" size={16} color={COLORS.accent} />
              <Text style={styles.legalLinkText}>Termini di utilizzo (EULA)</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.legalDisclaimer}>
            Pagamento sicuro tramite {getPaymentMethodLabel()}.{' '}
            L'abbonamento si rinnova automaticamente alla fine di ogni periodo di fatturazione. 
            Puoi annullare il rinnovo automatico in qualsiasi momento dalle impostazioni del tuo account.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  scrollContentTablet: {
    paddingHorizontal: 40,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  // State cards
  stateCard: {
    marginBottom: 16,
    padding: 16,
  },
  errorCard: {
    borderColor: COLORS.error,
    borderWidth: 1,
  },
  warningCard: {
    borderColor: COLORS.warning,
    borderWidth: 1,
  },
  stateContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stateTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  stateText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.error,
  },
  errorMessage: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.warning,
  },
  warningMessage: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    padding: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.accent,
    marginLeft: 8,
  },
  // Debug
  debugCard: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.accent + '40',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.accent,
    marginBottom: 8,
  },
  debugText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 2,
  },
  // Status
  statusCard: {
    marginBottom: 24,
  },
  statusLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  expiresText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  // Section
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  // Plan card
  planCard: {
    marginBottom: 12,
  },
  planCardSelected: {
    borderWidth: 2,
    borderColor: COLORS.secondary,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioOuterSelected: {
    borderColor: COLORS.secondary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.secondary,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  planDescription: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  planPrice: {
    alignItems: 'flex-end',
  },
  originalPrice: {
    fontSize: 14,
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  pricePeriod: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  // Subscription info - Apple compliance
  subscriptionInfoCard: {
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: COLORS.surface,
  },
  subscriptionInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  autoRenewContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.warning + '15',
    borderRadius: 8,
  },
  autoRenewText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 8,
    lineHeight: 18,
  },
  // Promo
  promoCard: {
    marginBottom: 16,
  },
  promoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 8,
  },
  promoInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    overflow: 'hidden',
  },
  promoInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  promoButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginRight: 4,
    marginVertical: 4,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  promoButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.background,
  },
  promoAppliedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  promoAppliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  promoAppliedText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
    marginLeft: 8,
  },
  removePromoButton: {
    padding: 4,
  },
  // Features
  featuresCard: {
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 10,
    flex: 1,
  },
  // Buttons
  subscribeButton: {
    marginBottom: 12,
  },
  restoreButton: {
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
  },
  restoreButtonText: {
    fontSize: 14,
    color: COLORS.accent,
    textDecorationLine: 'underline',
  },
  // Legal section - Apple compliance
  legalSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  legalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  legalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  legalLinkText: {
    fontSize: 14,
    color: COLORS.accent,
    marginLeft: 4,
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    color: COLORS.textMuted,
    marginHorizontal: 4,
  },
  legalDisclaimer: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
