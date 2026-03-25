// Club Subscription Screen - Uses native IAP with comprehensive state management
import React, { useEffect, useState } from 'react';
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

export default function ClubSubscriptionScreen() {
  const router = useRouter();
  const { session_id } = useLocalSearchParams<{ session_id?: string }>();
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
  
  // Debug mode - show detailed IAP status
  const [showDebug, setShowDebug] = useState(__DEV__ || true); // Always show for now

  // Use the subscription hook
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

  // Show only monthly plan for now
  const showYearlyPlan = false;

  const plans = {
    monthly: {
      name: t('monthly'),
      price: 49.99,
      period: t('per_month'),
      productId: PRODUCT_IDS.MONTHLY,
    },
    ...(showYearlyPlan ? {
      yearly: {
        name: t('yearly'),
        price: 399.99,
        period: t('per_year'),
        savings: '33%',
        productId: PRODUCT_IDS.YEARLY,
      },
    } : {}),
  };

  // Get price from store products
  const getStorePrice = (productId: string): string | null => {
    if (!iapProducts || iapProducts.length === 0) return null;
    const product = iapProducts.find((p: any) => p.id === productId || p.productId === productId);
    if (product) {
      return (product as any).displayPrice || (product as any).localizedPrice || (product as any).price;
    }
    return null;
  };

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

  const fetchClub = async () => {
    try {
      const data = await apiClient.getMyClub();
      setClub(data);
    } catch (error) {
      console.error('Error fetching club:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkPaymentStatus = async (sessionId: string) => {
    setIsProcessing(true);
    let attempts = 0;
    const maxAttempts = 5;
    const pollInterval = 2000;

    const poll = async () => {
      try {
        const status = await apiClient.getSubscriptionStatus(sessionId);
        if (status.payment_status === 'paid') {
          Alert.alert(t('success'), 'Abbonamento attivato con successo!');
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

  // Handle IAP purchase
  const handleIAPPurchase = async () => {
    const plan = plans[selectedPlan];
    if (!plan?.productId) {
      Alert.alert('Errore', 'Piano non disponibile');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('[Subscription] Starting native IAP purchase for:', selectedPlan, plan.productId);

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
      console.error('[Subscription] IAP error:', error);
      errorHaptic();
      Alert.alert('Errore', error.message || 'Errore durante l\'acquisto');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Stripe checkout for web
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
      console.error('[Subscription] Restore error:', error);
      Alert.alert('Errore', 'Impossibile ripristinare gli acquisti');
    }
  };

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
      case 'active': return t('subscription_active');
      case 'trial': return t('trial');
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

  // Get state-specific icon and color
  const getStateIcon = (): { name: keyof typeof Ionicons.glyphMap; color: string } => {
    switch (iapState) {
      case 'initializing':
      case 'connecting':
        return { name: 'hourglass-outline', color: COLORS.warning };
      case 'connected':
      case 'fetching':
        return { name: 'cloud-download-outline', color: COLORS.warning };
      case 'ready':
        return { name: 'checkmark-circle', color: COLORS.success };
      case 'purchasing':
      case 'restoring':
        return { name: 'sync-outline', color: COLORS.accent };
      case 'error':
        return { name: 'alert-circle', color: COLORS.error };
      case 'unavailable':
        return { name: 'close-circle', color: COLORS.textMuted };
      default:
        return { name: 'help-circle', color: COLORS.textMuted };
    }
  };

  // Render IAP status banner with detailed info
  const renderIAPStatus = () => {
    if (!shouldUseNativeIAP()) return null;

    const stateIcon = getStateIcon();
    const showRetry = iapState === 'error';
    const showRefresh = iapState === 'ready' && iapProducts.length === 0;

    return (
      <TouchableOpacity
        style={[
          styles.iapStatusBanner,
          iapState === 'error' && styles.iapStatusBannerError,
          iapState === 'ready' && iapProducts.length > 0 && styles.iapStatusBannerSuccess,
        ]}
        onPress={() => setShowDebug(!showDebug)}
        onLongPress={showRetry ? retryConnection : (showRefresh ? refreshProducts : undefined)}
      >
        <Ionicons name={stateIcon.name} size={18} color={stateIcon.color} />
        <View style={styles.iapStatusTextContainer}>
          <Text style={[styles.iapStatusText, { color: stateIcon.color }]}>
            {debugInfo}
          </Text>
          {showDebug && (
            <Text style={styles.iapDebugText}>
              Stato: {iapState} | Connesso: {iapConnected ? 'Sì' : 'No'} | Prodotti: {iapProducts.length}
            </Text>
          )}
          {iapError && showDebug && (
            <Text style={styles.iapErrorText}>
              Errore [{iapError.code}]: {iapError.message}
            </Text>
          )}
        </View>
        {(showRetry || showRefresh) && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={showRetry ? retryConnection : refreshProducts}
          >
            <Ionicons name="refresh" size={20} color={COLORS.accent} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  // Render product debug info
  const renderProductDebug = () => {
    if (!showDebug || !shouldUseNativeIAP()) return null;

    return (
      <Card style={styles.debugCard}>
        <Text style={styles.debugTitle}>Debug IAP</Text>
        <Text style={styles.debugText}>Platform: {Platform.OS}</Text>
        <Text style={styles.debugText}>SKUs richiesti: {ACTIVE_SUBSCRIPTION_SKUS.join(', ')}</Text>
        <Text style={styles.debugText}>Prodotti caricati: {iapProducts.length}</Text>
        {iapProducts.map((p: any, i: number) => (
          <Text key={i} style={styles.debugText}>
            → {p.id}: {p.displayPrice || p.price || 'N/A'}
          </Text>
        ))}
        {iapError && (
          <>
            <Text style={[styles.debugText, { color: COLORS.error }]}>
              Errore: {iapError.code}
            </Text>
            <Text style={[styles.debugText, { color: COLORS.error }]}>
              {iapError.message}
            </Text>
            <Text style={[styles.debugText, { color: COLORS.textMuted }]}>
              Step: {iapError.step}
            </Text>
          </>
        )}
      </Card>
    );
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message={t('loading')} />;
  }

  // Determine if subscribe button should be enabled
  const canSubscribe = shouldUseNativeIAP()
    ? (iapReady && iapProducts.length > 0 && !isPurchasing && !isProcessing)
    : !isProcessing;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('subscription')}</Text>
        <TouchableOpacity onPress={() => setShowDebug(!showDebug)}>
          <Ionicons name="bug-outline" size={24} color={showDebug ? COLORS.accent : COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* IAP Status Banner */}
        {renderIAPStatus()}

        {/* Product Debug Info */}
        {renderProductDebug()}

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
                {club.subscription_status === 'active' ? t('subscription_expires') : 'Scade il'}:{' '}
                {format(parseISO(club.subscription_expires_at), 'dd/MM/yyyy')}
              </Text>
            )}
          </Card>
        )}

        {/* Plans */}
        <Text style={styles.sectionTitle}>{t('pricing')}</Text>

        {Object.entries(plans).map(([planId, plan]) => {
          const storePrice = getStorePrice(plan.productId);

          return (
            <TouchableOpacity
              key={planId}
              onPress={() => setSelectedPlan(planId as 'monthly' | 'yearly')}
            >
              <Card
                style={[
                  styles.planCard,
                  selectedPlan === planId && styles.planCardSelected,
                ]}
              >
                {'savings' in plan && plan.savings && (
                  <View style={styles.savingsBadge}>
                    <Text style={styles.savingsText}>Risparmia {plan.savings}</Text>
                  </View>
                )}
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
                      <Text style={styles.originalPrice}>€{plan.price.toFixed(2)}</Text>
                    )}
                    <Text style={styles.priceValue}>
                      {storePrice || `€${getDiscountedPrice(plan.price).toFixed(2)}`}
                    </Text>
                    <Text style={styles.pricePeriod}>{plan.period}</Text>
                    {!storePrice && shouldUseNativeIAP() && (
                      <Text style={styles.priceNote}>(prezzo indicativo)</Text>
                    )}
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}

        {/* Promo Code Section - Only show if not using IAP */}
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
                    <Ionicons name="hourglass-outline" size={20} color={COLORS.text} />
                  ) : (
                    <Text style={styles.promoButtonText}>Applica</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </Card>
        )}

        {/* Features */}
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
            promoApplied && promoType === 'trial_months'
              ? `Attiva prova ${promoValue} mesi`
              : (club?.subscription_status === 'active' ? 'Cambia piano' : t('subscribe'))
          }
          onPress={handleSubscribe}
          loading={isProcessing || isPurchasing}
          disabled={!canSubscribe}
          fullWidth
          size="large"
          style={styles.subscribeButton}
        />

        {/* Disabled reason */}
        {shouldUseNativeIAP() && !canSubscribe && !isPurchasing && !isProcessing && (
          <Text style={styles.disabledReason}>
            {!iapConnected && 'Store non connesso. '}
            {iapConnected && iapProducts.length === 0 && 'Prodotti non caricati. '}
            {iapError && `Errore: ${iapError.message}`}
          </Text>
        )}

        {/* Restore Purchases - Only for mobile */}
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

        <Text style={styles.disclaimer}>
          Pagamento sicuro tramite {getPaymentMethodLabel()}.{' '}
          {shouldUseNativeIAP()
            ? 'L\'abbonamento si rinnova automaticamente.'
            : 'Puoi cancellare in qualsiasi momento.'}
        </Text>
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
    paddingVertical: 8,
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
    paddingBottom: 24,
  },
  iapStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iapStatusBannerError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.error + '10',
  },
  iapStatusBannerSuccess: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.success + '10',
  },
  iapStatusTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  iapStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  iapDebugText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  iapErrorText: {
    fontSize: 11,
    color: COLORS.error,
    marginTop: 2,
  },
  retryButton: {
    padding: 8,
  },
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  planCard: {
    marginBottom: 12,
    position: 'relative',
  },
  planCardSelected: {
    borderWidth: 2,
    borderColor: COLORS.secondary,
  },
  savingsBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: COLORS.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  savingsText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
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
  priceNote: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  promoCard: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
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
  featuresCard: {
    marginTop: 12,
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
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 10,
  },
  subscribeButton: {
    marginBottom: 8,
  },
  disabledReason: {
    fontSize: 12,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: 12,
  },
  restoreButton: {
    alignItems: 'center',
    padding: 12,
    marginBottom: 12,
  },
  restoreButtonText: {
    fontSize: 14,
    color: COLORS.accent,
    textDecorationLine: 'underline',
  },
  disclaimer: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
