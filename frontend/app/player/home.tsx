// Player Home Screen
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
import { MatchCard, LoadingSpinner, EmptyState, Card } from '../../src/components';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { COLORS, SPORTS } from '../../src/utils/constants';
import { apiClient } from '../../src/api/client';
import { Match, PlayerRating } from '../../src/types';

export default function PlayerHomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t } = useLanguage();

  const [matches, setMatches] = useState<Match[]>([]);
  const [ratings, setRatings] = useState<PlayerRating[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [matchesData, ratingsData] = await Promise.all([
        apiClient.listMatches({ status: 'open', limit: 5 }),
        apiClient.getPlayerRatings(),
      ]);
      setMatches(matchesData);
      setRatings(ratingsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getRatingForSport = (sport: string) => {
    return ratings.find((r) => r.sport === sport);
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message={t('loading')} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{t('welcome')},</Text>
            <Text style={styles.userName}>{user?.name || 'Giocatore'}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push('/player/notifications')}
            >
              <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: COLORS.primary + '20' }]}
            onPress={() => router.push('/player/search')}
          >
            <Ionicons name="search" size={28} color={COLORS.primary} />
            <Text style={[styles.quickActionText, { color: COLORS.primary }]}>
              {t('find_match')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: COLORS.secondary + '20' }]}
            onPress={() => router.push('/player/my-matches')}
          >
            <Ionicons name="calendar" size={28} color={COLORS.secondary} />
            <Text style={[styles.quickActionText, { color: COLORS.secondary }]}>
              {t('my_matches')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Ratings Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('rating')}</Text>
            <TouchableOpacity onPress={() => router.push('/player/profile')}>
              <Text style={styles.seeAll}>{t('statistics')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.ratingsRow}>
              {SPORTS.map((sport) => {
                const rating = getRatingForSport(sport.id);
                return (
                  <Card key={sport.id} style={[styles.ratingCard, { borderColor: sport.color }]}>
                    <View style={[styles.sportIconContainer, { backgroundColor: sport.color + '20' }]}>
                      <Ionicons
                        name={sport.id === 'calcetto' || sport.id === 'calcio8' ? 'football-outline' : 'tennisball-outline'}
                        size={24}
                        color={sport.color}
                      />
                    </View>
                    <Text style={styles.sportName}>{sport.name}</Text>
                    <Text style={[styles.ratingValue, { color: sport.color }]}>
                      {rating?.rating || 1200}
                    </Text>
                    <View style={styles.ratingStats}>
                      <Text style={styles.ratingStat}>
                        {rating?.wins || 0}W / {rating?.losses || 0}L
                      </Text>
                    </View>
                  </Card>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Recent Matches */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Partite Disponibili</Text>
            <TouchableOpacity onPress={() => router.push('/player/search')}>
              <Text style={styles.seeAll}>{t('all')}</Text>
            </TouchableOpacity>
          </View>
          {matches.length > 0 ? (
            matches.map((match) => (
              <MatchCard
                key={match.match_id}
                match={match}
                onPress={() => router.push(`/match/${match.match_id}`)}
              />
            ))
          ) : (
            <EmptyState
              icon="tennisball-outline"
              title={t('no_matches_found')}
              message="Non ci sono partite disponibili al momento"
              actionLabel={t('search')}
              onAction={() => router.push('/player/search')}
            />
          )}
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
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  quickAction: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  seeAll: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  ratingsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  ratingCard: {
    width: 140,
    alignItems: 'center',
    borderWidth: 1,
  },
  sportIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  sportName: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  ratingValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  ratingStats: {
    marginTop: 4,
  },
  ratingStat: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
});
