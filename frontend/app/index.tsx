// Main Entry Screen - Modern Welcome Page
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  Dimensions, 
  Platform,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withSequence,
  withTiming,
  FadeInUp,
  FadeInDown,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, SportIcon, LoadingSpinner } from '../src/components';
import { useAuth } from '../src/contexts/AuthContext';
import { useLanguage } from '../src/contexts/LanguageContext';
import { COLORS, SPORTS } from '../src/utils/constants';

const { width, height } = Dimensions.get('window');

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function Index() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [showContent, setShowContent] = useState(false);

  // Simple approach: show content after max 2 seconds OR when auth check is done
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowContent(true);
    }, 2000);

    if (!authLoading) {
      setShowContent(true);
      clearTimeout(timer);
    }

    return () => clearTimeout(timer);
  }, [authLoading]);

  // Handle Google OAuth callback
  useEffect(() => {
    if (Platform.OS === 'web') {
      const hash = window.location.hash;
      if (hash && hash.includes('session_id=')) {
        router.replace('/auth/callback');
        return;
      }
    }
  }, []);

  // Redirect authenticated users
  useEffect(() => {
    if (showContent && isAuthenticated && user) {
      if (user.role === 'super_admin') {
        router.replace('/admin/dashboard');
      } else if (user.role === 'club_admin') {
        router.replace('/club/dashboard');
      } else {
        router.replace('/player/home');
      }
    }
  }, [showContent, isAuthenticated, user]);

  // Check onboarding only once when content is ready
  useEffect(() => {
    if (showContent && !isAuthenticated) {
      AsyncStorage.getItem('onboarding_completed').then((completed) => {
        if (!completed) {
          router.replace('/onboarding');
        }
      }).catch(() => {});
    }
  }, [showContent, isAuthenticated]);

  if (!showContent) {
    return <LoadingSpinner fullScreen message={t('loading')} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo Section */}
        <Animated.View 
          entering={FadeInDown.duration(600).delay(100)}
          style={styles.logoSection}
        >
          <Image
            source={require('../assets/images/logo-24.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>Match Sport 24</Text>
        </Animated.View>

        {/* Hero Section */}
        <Animated.View 
          entering={FadeInUp.duration(600).delay(200)}
          style={styles.heroSection}
        >
          <Text style={styles.heroTitle}>{t('welcome')}</Text>
          <Text style={styles.heroSubtitle}>
            Trova e prenota partite di Padel, Tennis, Calcetto e Calcio a 8 nella tua città
          </Text>
        </Animated.View>

        {/* Sports Grid - Modern Cards */}
        <Animated.View 
          entering={FadeInUp.duration(600).delay(300)}
          style={styles.sportsGrid}
        >
          {SPORTS.map((sport, index) => (
            <Animated.View
              key={sport.id}
              entering={FadeInUp.duration(400).delay(400 + index * 100)}
              style={[styles.sportCard, { borderColor: sport.color + '40' }]}
            >
              <LinearGradient
                colors={[sport.color + '20', sport.color + '05']}
                style={styles.sportCardGradient}
              >
                <View style={[styles.sportIconWrapper, { backgroundColor: sport.color + '25' }]}>
                  <SportIcon sport={sport.id as any} size={32} color={sport.color} />
                </View>
                <Text style={[styles.sportCardName, { color: sport.color }]}>
                  {sport.name}
                </Text>
              </LinearGradient>
            </Animated.View>
          ))}
        </Animated.View>

        {/* CTA Buttons */}
        <Animated.View 
          entering={FadeInUp.duration(600).delay(600)}
          style={styles.ctaSection}
        >
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/auth/register')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryDark]}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="person-add-outline" size={22} color="#FFF" />
              <Text style={styles.primaryButtonText}>{t('register_as_player')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/auth/register-club')}
            activeOpacity={0.85}
          >
            <Ionicons name="business-outline" size={22} color={COLORS.secondary} />
            <Text style={styles.secondaryButtonText}>{t('register_as_club')}</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('have_account')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/auth/login')}
            activeOpacity={0.85}
          >
            <Text style={styles.loginButtonText}>{t('login')}</Text>
            <Ionicons name="arrow-forward" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </Animated.View>

        {/* Features Section */}
        <Animated.View 
          entering={FadeInUp.duration(600).delay(700)}
          style={styles.featuresSection}
        >
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: COLORS.primary + '20' }]}>
              <Ionicons name="search" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.featureTitle}>Trova</Text>
            <Text style={styles.featureDesc}>partite</Text>
          </View>
          
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: COLORS.secondary + '20' }]}>
              <Ionicons name="chatbubbles" size={20} color={COLORS.secondary} />
            </View>
            <Text style={styles.featureTitle}>Chat</Text>
            <Text style={styles.featureDesc}>di gruppo</Text>
          </View>
          
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: COLORS.accent + '20' }]}>
              <Ionicons name="trophy" size={20} color={COLORS.accent} />
            </View>
            <Text style={styles.featureTitle}>Rating</Text>
            <Text style={styles.featureDesc}>ELO</Text>
          </View>
          
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: COLORS.calcio8 + '20' }]}>
              <Ionicons name="star" size={20} color={COLORS.calcio8} />
            </View>
            <Text style={styles.featureTitle}>Recensioni</Text>
            <Text style={styles.featureDesc}>circoli</Text>
          </View>
        </Animated.View>
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
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  logoImage: {
    width: 90,
    height: 90,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  sportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 16,
    gap: 12,
  },
  sportCard: {
    width: (width - 60) / 2,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sportCardGradient: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  sportIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  sportCardName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  ctaSection: {
    paddingVertical: 24,
  },
  primaryButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.secondary + '50',
    backgroundColor: COLORS.secondary + '10',
    gap: 10,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
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
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  featuresSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 20,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  featureItem: {
    alignItems: 'center',
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  featureDesc: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
