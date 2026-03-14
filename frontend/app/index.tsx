// Main Entry Screen - Landing/Auth Check
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../src/components';
import { useAuth } from '../src/contexts/AuthContext';
import { useLanguage } from '../src/contexts/LanguageContext';
import { COLORS, SPORTS } from '../src/utils/constants';
import { LoadingSpinner } from '../src/components/LoadingSpinner';

const { width, height } = Dimensions.get('window');

export default function Index() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [forceShow, setForceShow] = useState(false);

  // Force show content after 3 seconds to prevent infinite loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setForceShow(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const isLoading = authLoading && !forceShow;

  useEffect(() => {
    // Check URL for session_id (Google OAuth callback)
    if (Platform.OS === 'web') {
      const hash = window.location.hash;
      if (hash && hash.includes('session_id=')) {
        router.replace('/auth/callback');
        return;
      }
    }

    // Redirect based on auth status
    if (!isLoading && isAuthenticated && user) {
      if (user.role === 'super_admin') {
        router.replace('/admin/dashboard');
      } else if (user.role === 'club_admin') {
        router.replace('/club/dashboard');
      } else {
        router.replace('/player/home');
      }
    }
  }, [isLoading, isAuthenticated, user]);

  if (isLoading) {
    return <LoadingSpinner fullScreen message={t('loading')} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Ionicons name="tennisball" size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.logoText}>Match Sport 24</Text>
        </View>
      </View>

      <View style={styles.heroSection}>
        <Text style={styles.heroTitle}>{t('welcome')}</Text>
        <Text style={styles.heroSubtitle}>
          Trova e prenota partite di Padel, Tennis e Calcetto nella tua città
        </Text>

        <View style={styles.sportsRow}>
          {SPORTS.map((sport) => (
            <View key={sport.id} style={[styles.sportItem, { backgroundColor: sport.color + '20' }]}>
              <Ionicons
                name={sport.id === 'calcetto' ? 'football-outline' : 'tennisball-outline'}
                size={24}
                color={sport.color}
              />
              <Text style={[styles.sportName, { color: sport.color }]}>{sport.name}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.ctaSection}>
        <Button
          title={t('register_as_player')}
          onPress={() => router.push('/auth/register')}
          variant="primary"
          size="large"
          fullWidth
          icon={<Ionicons name="person-outline" size={20} color={COLORS.text} />}
        />

        <Button
          title={t('register_as_club')}
          onPress={() => router.push('/auth/register-club')}
          variant="outline"
          size="large"
          fullWidth
          style={styles.secondaryButton}
          icon={<Ionicons name="business-outline" size={20} color={COLORS.primary} />}
        />

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('have_account')}</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button
          title={t('login')}
          onPress={() => router.push('/auth/login')}
          variant="ghost"
          size="large"
          fullWidth
        />
      </View>

      <View style={styles.features}>
        <View style={styles.featureItem}>
          <Ionicons name="search-outline" size={24} color={COLORS.primary} />
          <Text style={styles.featureText}>Trova partite</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="chatbubbles-outline" size={24} color={COLORS.secondary} />
          <Text style={styles.featureText}>Chat di gruppo</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="trophy-outline" size={24} color={COLORS.accent} />
          <Text style={styles.featureText}>Rating ELO</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
  },
  header: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  heroSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 18,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 32,
  },
  sportsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  sportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  sportName: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  ctaSection: {
    paddingBottom: 24,
  },
  secondaryButton: {
    marginTop: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    color: COLORS.textMuted,
    marginHorizontal: 16,
    fontSize: 14,
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  featureItem: {
    alignItems: 'center',
  },
  featureText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
});
