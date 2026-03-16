// Club Subscription Screen
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
  const [promoMessage, setPromoMessage] = useState('');
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  const plans = {
    monthly: { name: t('monthly'), price: 49.99, period: t('per_month') },
    yearly: { name: t('yearly'), price: 399.99, period: t('per_year'), savings: '33%' },
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
        setPromoMessage(response.message || '');
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
    setPromoMessage('');
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
          // Clear URL params
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

  const handleSubscribe = async () => {
    // If a trial promo is applied, activate it directly
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

    // Otherwise proceed with Stripe checkout
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

  if (isLoading) {
    return <LoadingSpinner fullScreen message={t('loading')} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('subscription')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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

        {Object.entries(plans).map(([planId, plan]) => (
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
              {plan.savings && (
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
                    €{getDiscountedPrice(plan.price).toFixed(2)}
                  </Text>
                  <Text style={styles.pricePeriod}>{plan.period}</Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        ))}

        {/* Promo Code Section */}
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
          <Text style={styles.promoHint}>
            Codici disponibili: TRIAL3MESI, SCONTO20, SCONTO50
          </Text>
        </Card>

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
          loading={isProcessing}
          fullWidth
          size="large"
          style={styles.subscribeButton}
        />

        <Text style={styles.disclaimer}>
          Pagamento sicuro tramite Stripe. Puoi cancellare in qualsiasi momento.
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
  promoHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 8,
    fontStyle: 'italic',
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
    marginBottom: 12,
  },
  disclaimer: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
