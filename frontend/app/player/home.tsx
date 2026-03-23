// Player Home Screen - Modern UI
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
import { LinearGradient } from 'expo-linear-gradient';
import { MatchCard, EmptyState, Card, MatchCardSkeleton, RatingCardSkeleton } from '../../src/components';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { COLORS, SPORTS, SHADOWS, BORDER_RADIUS } from '../../src/utils/constants';
import { apiClient } from '../../src/api/client';
import { Match, PlayerRating } from '../../src/types';
import { lightHaptic } from '../../src/utils/haptics';

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

  const renderQuickAction = (
    icon: keyof typeof Ionicons.glyphMap,
    color: string,
    label: string,
    onPress: () => void
  ) => (
    <TouchableOpacity
      style={styles.quickAction}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={[color + '25', color + '10']}
        style={styles.quickActionGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={[styles.quickActionIcon, { backgroundColor: color + '30' }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
        <Text style={[styles.quickActionText, { color }]}>
          {label}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header skeleton */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>{t('welcome')},</Text>
              <Text style={styles.userName}>{user?.name || 'Giocatore'}</Text>
            </View>
          </View>
          
          {/* Quick actions skeleton - just show them */}
          <View style={styles.quickActions}>
            {renderQuickAction('search', COLORS.primary, t('find_match'), () => {})}
            {renderQuickAction('calendar', COLORS.secondary, t('my_matches'), () => {})}
            {renderQuickAction('heart', COLORS.error, 'Preferiti', () => {})}
          </View>
          
          {/* Ratings skeleton */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('rating')}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.ratingsRow}>
                {[1, 2, 3, 4].map((i) => (
                  <RatingCardSkeleton key={i} />
                ))}
              </View>
            </ScrollView>
          </View>
          
          {/* Matches skeleton */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Partite Disponibili</Text>
            </View>
            <MatchCardSkeleton />
            <MatchCardSkeleton />
            <MatchCardSkeleton />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Background accent */}
      <LinearGradient
        colors={['rgba(0, 214, 143, 0.08)', 'transparent']}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
      />
      
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
          {renderQuickAction('search', COLORS.primary, t('find_match'), () => router.push('/player/search'))}
          {renderQuickAction('calendar', COLORS.secondary, t('my_matches'), () => router.push('/player/my-matches'))}
          {renderQuickAction('heart', COLORS.error, 'Preferiti', () => router.push('/player/favorites'))}
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
                  <View key={sport.id} style={styles.ratingCardWrapper}>
                    <LinearGradient
                      colors={[sport.color + '20', sport.color + '08']}
                      style={styles.ratingCard}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <View style={[styles.sportIconContainer, { backgroundColor: sport.color + '30' }]}>
                        <Ionicons
                          name={sport.id === 'calcetto' || sport.id === 'calcio8' ? 'football-outline' : 'tennisball-outline'}
                          size={22}
                          color={sport.color}
                        />
                      </View>
                      <Text style={styles.sportName}>{sport.name}</Text>
                      <Text style={[styles.ratingValue, { color: sport.color }]}>
                        {rating?.rating || 1200}
                      </Text>
                      <View style={styles.ratingStats}>
                        <View style={[styles.statBadge, { backgroundColor: COLORS.success + '20' }]}>
                          <Text style={[styles.statText, { color: COLORS.success }]}>
                            {rating?.wins || 0}W
                          </Text>
                        </View>
                        <View style={[styles.statBadge, { backgroundColor: COLORS.error + '20' }]}>
                          <Text style={[styles.statText, { color: COLORS.error }]}>
                            {rating?.losses || 0}L
                          </Text>
                        </View>
                      </View>
                    </LinearGradient>
                  </View>
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
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
  },
  greeting: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  userName: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  quickAction: {
    flex: 1,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  quickActionGradient: {
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  seeAll: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  ratingsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 16,
  },
  ratingCardWrapper: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  ratingCard: {
    width: 130,
    padding: 16,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  sportIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  sportName: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 6,
    fontWeight: '500',
  },
  ratingValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  ratingStats: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 6,
  },
  statBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  statText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
