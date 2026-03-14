// Admin Clubs Management Screen
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../src/components';
import { apiClient } from '../../src/api/client';
import { COLORS } from '../../src/utils/constants';

interface Club {
  club_id: string;
  name: string;
  city: string;
  address: string;
  courts_count: number;
  matches_count: number;
  subscription_status: string;
  subscription_expires: string | null;
}

export default function AdminClubsScreen() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchClubs = async () => {
    try {
      const response = await apiClient.get('/admin/clubs');
      setClubs(response.data);
    } catch (error) {
      console.log('Error fetching clubs:', error);
      // Mock data for demo
      setClubs([
        { 
          club_id: '1', 
          name: 'Padel Club Milano', 
          city: 'Milano', 
          address: 'Via Roma 123',
          courts_count: 4,
          matches_count: 45,
          subscription_status: 'active',
          subscription_expires: '2026-06-15'
        },
        { 
          club_id: '2', 
          name: 'Tennis Club Roma', 
          city: 'Roma', 
          address: 'Via Veneto 50',
          courts_count: 6,
          matches_count: 78,
          subscription_status: 'active',
          subscription_expires: '2026-08-01'
        },
        { 
          club_id: '3', 
          name: 'Calcetto Napoli', 
          city: 'Napoli', 
          address: 'Via Toledo 200',
          courts_count: 2,
          matches_count: 23,
          subscription_status: 'trial',
          subscription_expires: '2026-03-28'
        },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchClubs();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchClubs();
  };

  const getSubscriptionBadge = (status: string) => {
    switch (status) {
      case 'active':
        return { bg: COLORS.success + '20', text: COLORS.success, label: 'Attivo' };
      case 'trial':
        return { bg: COLORS.warning + '20', text: COLORS.warning, label: 'Prova' };
      case 'expired':
        return { bg: COLORS.error + '20', text: COLORS.error, label: 'Scaduto' };
      default:
        return { bg: COLORS.textMuted + '20', text: COLORS.textMuted, label: 'N/A' };
    }
  };

  const filteredClubs = clubs.filter(club =>
    club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    club.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderClub = ({ item }: { item: Club }) => {
    const subBadge = getSubscriptionBadge(item.subscription_status);
    
    return (
      <Card style={styles.clubCard}>
        <View style={styles.clubHeader}>
          <View style={styles.clubIcon}>
            <Ionicons name="business" size={24} color={COLORS.secondary} />
          </View>
          <View style={styles.clubInfo}>
            <Text style={styles.clubName}>{item.name}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.clubLocation}>{item.city}</Text>
            </View>
          </View>
          <View style={[styles.subBadge, { backgroundColor: subBadge.bg }]}>
            <Text style={[styles.subBadgeText, { color: subBadge.text }]}>
              {subBadge.label}
            </Text>
          </View>
        </View>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="tennisball-outline" size={18} color={COLORS.primary} />
            <Text style={styles.statValue}>{item.courts_count}</Text>
            <Text style={styles.statLabel}>Campi</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.success} />
            <Text style={styles.statValue}>{item.matches_count}</Text>
            <Text style={styles.statLabel}>Partite</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={18} color={COLORS.warning} />
            <Text style={styles.statValue}>
              {item.subscription_expires 
                ? new Date(item.subscription_expires).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
                : '-'}
            </Text>
            <Text style={styles.statLabel}>Scadenza</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.viewButton}>
          <Text style={styles.viewButtonText}>Visualizza dettagli</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.secondary} />
        </TouchableOpacity>
      </Card>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.warning} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestione Circoli</Text>
        <Text style={styles.subtitle}>{filteredClubs.length} circoli registrati</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cerca circolo o città..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: COLORS.success + '20' }]}>
          <Text style={[styles.summaryNumber, { color: COLORS.success }]}>
            {clubs.filter(c => c.subscription_status === 'active').length}
          </Text>
          <Text style={styles.summaryLabel}>Attivi</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: COLORS.warning + '20' }]}>
          <Text style={[styles.summaryNumber, { color: COLORS.warning }]}>
            {clubs.filter(c => c.subscription_status === 'trial').length}
          </Text>
          <Text style={styles.summaryLabel}>In Prova</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: COLORS.error + '20' }]}>
          <Text style={[styles.summaryNumber, { color: COLORS.error }]}>
            {clubs.filter(c => c.subscription_status === 'expired').length}
          </Text>
          <Text style={styles.summaryLabel}>Scaduti</Text>
        </View>
      </View>

      <FlatList
        data={filteredClubs}
        renderItem={renderClub}
        keyExtractor={(item) => item.club_id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.warning}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="business-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Nessun circolo trovato</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  clubCard: {
    marginBottom: 12,
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  clubIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.secondary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubInfo: {
    flex: 1,
    marginLeft: 12,
  },
  clubName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  clubLocation: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  subBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  subBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginRight: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textMuted,
    marginTop: 12,
  },
});
