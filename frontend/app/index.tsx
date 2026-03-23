// Main Entry Screen - Landing/Auth Check - Modern UI
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button } from '../src/components';
import { useAuth } from '../src/contexts/AuthContext';
import { useLanguage } from '../src/contexts/LanguageContext';
import { COLORS, SPORTS, SHADOWS, BORDER_RADIUS } from '../src/utils/constants';
import { LoadingSpinner } from '../src/components/LoadingSpinner';

const { width, height } = Dimensions.get('window');

export default function Index() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [forceShow, setForceShow] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  // Check onboarding status
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const completed = await AsyncStorage.getItem('onboarding_completed');
        if (!completed && !isAuthenticated) {
          router.replace('/onboarding');
          return;
        }
      } catch (error) {
        console.error('Error checking onboarding:', error);
      }
      setCheckingOnboarding(false);
    };
    checkOnboarding();
  }, [isAuthenticated]);

  // Force show content after 3 seconds to prevent infinite loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setForceShow(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const isLoading = (authLoading || checkingOnboarding) && !forceShow;

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
      {/* Background gradient overlay */}
      <LinearGradient
        colors={['rgba(0, 214, 143, 0.08)', 'transparent', 'rgba(79, 140, 255, 0.05)']}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <View style={styles.header}>
        <Image
          source={{ uri: 'https://customer-assets.emergentagent.com/job_padel-finder-app/artifacts/np98g9bo_logo%20pagna%20benvenuto.png' }}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.logoText}>Match Sport 24</Text>
      </View>

      <View style={styles.heroSection}>
        <Text style={styles.heroTitle}>{t('welcome')}</Text>
        <Text style={styles.heroSubtitle}>
          Trova e prenota partite di Padel, Tennis, Calcetto e Calcio a 8 nella tua città
        </Text>

        <View style={styles.sportsRow}>
          {SPORTS.map((sport) => (
            <View key={sport.id} style={[styles.sportItem, { borderColor: sport.color }]}>
              <LinearGradient
                colors={[sport.color + '30', sport.color + '10']}
                style={styles.sportGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons
                  name={sport.id === 'calcetto' || sport.id === 'calcio8' ? 'football-outline' : 'tennisball-outline'}
                  size={20}
                  color={sport.color}
                />
                <Text style={[styles.sportName, { color: sport.color }]}>{sport.name}</Text>
              </LinearGradient>
            </View>
          ))}        </View>
      </View>

      <View style={styles.ctaSection}>
        <Button
          title={t('register_as_player')}
          onPress={() => router.push('/auth/register')}
          variant="gradient"
          size="large"
          fullWidth
          icon={<Ionicons name="person-outline" size={20} color="#FFF" />}
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
          <View style={[styles.featureIcon, { backgroundColor: COLORS.primary + '20' }]}>
            <Ionicons name="search-outline" size={22} color={COLORS.primary} />
          </View>
          <Text style={styles.featureText}>Trova partite</Text>
        </View>
        <View style={styles.featureItem}>
          <View style={[styles.featureIcon, { backgroundColor: COLORS.secondary + '20' }]}>
            <Ionicons name="chatbubbles-outline" size={22} color={COLORS.secondary} />
          </View>
          <Text style={styles.featureText}>Chat di gruppo</Text>
        </View>
        <View style={styles.featureItem}>
          <View style={[styles.featureIcon, { backgroundColor: COLORS.accent + '20' }]}>
            <Ionicons name="trophy-outline" size={22} color={COLORS.accent} />
          </View>
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
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoImage: {
    width: 100,
    height: 100,
  },
  logoText: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  heroSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  heroTitle: {
    fontSize: 38,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 17,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  sportsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  sportItem: {
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sportGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sportName: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  ctaSection: {
    paddingBottom: 20,
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
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});
