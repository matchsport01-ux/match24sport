// Club Dashboard Screen
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, DashboardSkeleton } from '../../src/components';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { COLORS } from '../../src/utils/constants';
import { apiClient } from '../../src/api/client';
import { Club } from '../../src/types';
import { format, parseISO } from 'date-fns';
import { lightHaptic } from '../../src/utils/haptics';

export default function ClubDashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t } = useLanguage();

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 5;

  const fetchDashboard = async () => {
    try {
      const data = await apiClient.getClubDashboard();
      setDashboardData(data);
      setRetryCount(0); // Reset retry count on success
    } catch (error: any) {
      console.log('Dashboard fetch error:', error.response?.status, 'Retry:', retryCount);
      
      if (error.response?.status === 403 || error.response?.status === 404) {
        // Club might not be ready yet, retry a few times
        if (retryCount < maxRetries) {
          setRetryCount(prev => prev + 1);
          console.log(`Retrying dashboard fetch... attempt ${retryCount + 1}/${maxRetries}`);
          setTimeout(fetchDashboard, 1500);
          return;
        }
        
        // After max retries, check if club exists
        try {
          const club = await apiClient.getMyClub();
          if (club) {
            // Club exists but dashboard still fails - try one more time
            setTimeout(fetchDashboard, 2000);
            return;
          }
        } catch {
          // No club, redirect to onboarding
          router.replace('/club/onboarding');
          return;
        }
      }
      console.error('Error fetching dashboard:', error);
    } finally {
      if (retryCount >= maxRetries || dashboardData) {
        setIsLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  const getSubscriptionStatusColor = (status: string) => {
    switch (status) {
      case 'active': return COLORS.success;
      case 'trial': return COLORS.warning;
      case 'expired': return COLORS.error;
      default: return COLORS.textMuted;
    }
  };

  const getSubscriptionStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return t('subscription_active');
      case 'trial': return t('trial');
      case 'expired': return 'Scaduto';
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>{t('dashboard')}</Text>
              <Text style={styles.clubName}>Caricamento...</Text>
            </View>
          </View>
          <DashboardSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!dashboardData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="business-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Nessun circolo trovato</Text>
          <Text style={styles.emptySubtitle}>Registra il tuo circolo per iniziare</Text>
          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => router.push('/club/onboarding')}
          >
            <Text style={styles.registerButtonText}>Registra Circolo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { club, stats } = dashboardData;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.secondary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{t('dashboard')}</Text>
            <Text style={styles.clubName}>{club.name}</Text>
          </View>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/club/notifications')}
          >
            <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Subscription Status */}
        <Card style={styles.subscriptionCard}>
          <View style={styles.subscriptionHeader}>
            <View style={[
              styles.statusBadge,
              { backgroundColor: getSubscriptionStatusColor(club.subscription_status) + '20' }
            ]}>
              <View style={[
                styles.statusDot,
                { backgroundColor: getSubscriptionStatusColor(club.subscription_status) }
              ]} />
              <Text style={[
                styles.statusText,
                { color: getSubscriptionStatusColor(club.subscription_status) }
              ]}>
                {getSubscriptionStatusLabel(club.subscription_status)}
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/club/subscription')}>
              <Text style={styles.manageLink}>Gestisci</Text>
            </TouchableOpacity>
          </View>
          {club.subscription_expires_at && (
            <Text style={styles.expiresText}>
              {t('subscription_expires')}: {format(parseISO(club.subscription_expires_at), 'dd/MM/yyyy')}
            </Text>
          )}
        </Card>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: COLORS.primary + '20' }]}>
              <Ionicons name="tennisball" size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.statValue}>{stats.courts_count}</Text>
            <Text style={styles.statLabel}>{t('courts')}</Text>
          </Card>
          <Card style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: COLORS.success + '20' }]}>
              <Ionicons name="calendar" size={24} color={COLORS.success} />
            </View>
            <Text style={styles.statValue}>{stats.open_matches}</Text>
            <Text style={styles.statLabel}>Partite Aperte</Text>
          </Card>
          <Card style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: COLORS.warning + '20' }]}>
              <Ionicons name="people" size={24} color={COLORS.warning} />
            </View>
            <Text style={styles.statValue}>{stats.full_matches}</Text>
            <Text style={styles.statLabel}>Partite Piene</Text>
          </Card>
          <Card style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: COLORS.secondary + '20' }]}>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.secondary} />
            </View>
            <Text style={styles.statValue}>{stats.total_bookings}</Text>
            <Text style={styles.statLabel}>{t('bookings')}</Text>
          </Card>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Azioni Rapide</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.primary + '20' }]}
              onPress={() => router.push('/club/create-match')}
            >
              <Ionicons name="add-circle" size={28} color={COLORS.primary} />
              <Text style={[styles.actionText, { color: COLORS.primary }]}>
                Crea Partita
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.secondary + '20' }]}
              onPress={() => router.push('/club/courts')}
            >
              <Ionicons name="tennisball" size={28} color={COLORS.secondary} />
              <Text style={[styles.actionText, { color: COLORS.secondary }]}>
                Gestisci Campi
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Club Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Info Circolo</Text>
            <TouchableOpacity onPress={() => router.push('/club/edit-profile')}>
              <Text style={styles.editLink}>{t('edit')}</Text>
            </TouchableOpacity>
          </View>
          <Card>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color={COLORS.textSecondary} />
              <Text style={styles.infoText}>{club.address}, {club.city}</Text>
            </View>
            {club.phone && (
              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={20} color={COLORS.textSecondary} />
                <Text style={styles.infoText}>{club.phone}</Text>
              </View>
            )}
            {club.email && (
              <View style={styles.infoRow}>
                <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />
                <Text style={styles.infoText}>{club.email}</Text>
              </View>
            )}
          </Card>
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  greeting: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  clubName: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscriptionCard: {
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.secondary,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    fontSize: 14,
    fontWeight: '600',
  },
  manageLink: {
    fontSize: 14,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  expiresText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '47%',
    alignItems: 'center',
    paddingVertical: 20,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  editLink: {
    fontSize: 14,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 12,
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  registerButton: {
    marginTop: 24,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
});
