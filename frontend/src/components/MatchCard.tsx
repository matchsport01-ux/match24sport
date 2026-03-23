// Match Card Component - Modern UI
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Card } from './Card';
import { SportBadge } from './SportBadge';
import { COLORS, SHADOWS, BORDER_RADIUS } from '../utils/constants';
import { Match } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { format, parseISO } from 'date-fns';
import { it, es, fr, enUS } from 'date-fns/locale';

interface MatchCardProps {
  match: Match;
  onPress: () => void;
}

export function MatchCard({ match, onPress }: MatchCardProps) {
  const { t, language } = useLanguage();

  const getLocale = () => {
    switch (language) {
      case 'es': return es;
      case 'fr': return fr;
      case 'en': return enUS;
      default: return it;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      return format(date, 'EEE d MMM', { locale: getLocale() });
    } catch {
      return dateStr;
    }
  };

  const spotsLeft = match.max_players - match.current_players;
  const isFull = spotsLeft <= 0;
  const fillPercentage = (match.current_players / match.max_players) * 100;

  const getStatusColor = () => {
    switch (match.status) {
      case 'full': return COLORS.warning;
      case 'completed': return COLORS.textMuted;
      case 'cancelled': return COLORS.error;
      default: return COLORS.success;
    }
  };

  const getSportColor = () => {
    switch (match.sport) {
      case 'padel': return COLORS.padel;
      case 'tennis': return COLORS.tennis;
      case 'calcetto': return COLORS.calcetto;
      case 'calcio8': return COLORS.calcio8;
      default: return COLORS.primary;
    }
  };

  const getLevelLabel = () => {
    switch (match.skill_level) {
      case 'beginner': return t('beginner');
      case 'intermediate': return t('intermediate');
      case 'advanced': return t('advanced');
      default: return t('all_levels');
    }
  };

  const sportColor = getSportColor();

  return (
    <Card onPress={onPress} variant="elevated" style={styles.card}>
      {/* Top accent line */}
      <View style={[styles.accentLine, { backgroundColor: sportColor }]} />
      
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <SportBadge sport={match.sport} size="small" />
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {isFull ? t('full') : `${spotsLeft} ${t('spots_available')}`}
            </Text>
          </View>
        </View>

        {/* Club name */}
        <Text style={styles.clubName} numberOfLines={1}>{match.club_name}</Text>

        {/* Info grid */}
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <View style={[styles.infoIconContainer, { backgroundColor: COLORS.secondary + '20' }]}>
              <Ionicons name="calendar-outline" size={16} color={COLORS.secondary} />
            </View>
            <Text style={styles.infoText}>{formatDate(match.date)}</Text>
          </View>
          <View style={styles.infoItem}>
            <View style={[styles.infoIconContainer, { backgroundColor: COLORS.accent + '20' }]}>
              <Ionicons name="time-outline" size={16} color={COLORS.accent} />
            </View>
            <Text style={styles.infoText}>{match.start_time}</Text>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <View style={[styles.infoIconContainer, { backgroundColor: COLORS.error + '20' }]}>
              <Ionicons name="location-outline" size={16} color={COLORS.error} />
            </View>
            <Text style={styles.infoText} numberOfLines={1}>{match.club_city}</Text>
          </View>
          <View style={styles.infoItem}>
            <View style={[styles.infoIconContainer, { backgroundColor: COLORS.calcio8 + '20' }]}>
              <Ionicons name="trophy-outline" size={16} color={COLORS.calcio8} />
            </View>
            <Text style={styles.infoText}>{getLevelLabel()}</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <LinearGradient
              colors={[sportColor, sportColor + 'CC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${fillPercentage}%` }]}
            />
          </View>
          <Text style={styles.progressText}>
            {match.current_players}/{match.max_players}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.participants}>
            <Ionicons name="people" size={18} color={sportColor} />
            <Text style={[styles.participantsText, { color: sportColor }]}>
              {match.current_players} iscritti
            </Text>
          </View>
          <View style={[styles.priceTag, { backgroundColor: sportColor + '20' }]}>
            <Text style={[styles.price, { color: sportColor }]}>
              {match.price_per_player > 0
                ? `€${match.price_per_player.toFixed(0)}`
                : t('free')}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    padding: 0,
    overflow: 'hidden',
  },
  accentLine: {
    height: 4,
    width: '100%',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  clubName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  infoGrid: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  infoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    minWidth: 40,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  participants: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantsText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  priceTag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
  },
});
