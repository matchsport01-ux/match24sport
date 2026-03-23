// Forgot Password Screen
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '../../src/components';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { COLORS } from '../../src/utils/constants';
import { apiClient } from '../../src/api/client';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Inserisci la tua email');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await apiClient.forgotPassword(email);
      setIsSuccess(true);
      
      // In demo mode, show the reset token
      if (response.reset_token) {
        setResetToken(response.reset_token);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Errore durante la richiesta');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToReset = () => {
    if (resetToken) {
      router.push(`/auth/reset-password?token=${resetToken}`);
    }
  };

  if (isSuccess) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="mail-outline" size={64} color={COLORS.primary} />
          </View>
          <Text style={styles.successTitle}>Email Inviata!</Text>
          <Text style={styles.successText}>
            Se l'indirizzo email è registrato, riceverai le istruzioni per reimpostare la password.
          </Text>
          
          {/* Demo mode - show reset link */}
          {resetToken && (
            <View style={styles.demoBox}>
              <Text style={styles.demoLabel}>Demo Mode - Link di reset:</Text>
              <Button
                title="Reimposta Password"
                onPress={handleGoToReset}
                variant="primary"
                fullWidth
                style={{ marginTop: 12 }}
              />
            </View>
          )}
          
          <Button
            title="Torna al Login"
            onPress={() => router.push('/auth/login')}
            variant="outline"
            fullWidth
            style={{ marginTop: 24 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="lock-open-outline" size={48} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Password Dimenticata?</Text>
            <Text style={styles.subtitle}>
              Inserisci la tua email e ti invieremo le istruzioni per reimpostare la password.
            </Text>
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color={COLORS.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <Input
              label="Email"
              placeholder="nome@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon="mail-outline"
            />

            <Button
              title="Invia Istruzioni"
              onPress={handleForgotPassword}
              loading={isLoading}
              fullWidth
              size="large"
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Ricordi la password?</Text>
            <TouchableOpacity onPress={() => router.push('/auth/login')}>
              <Text style={styles.footerLink}> Accedi</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  header: {
    alignItems: 'center',
    marginVertical: 32,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.error + '20',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.error,
    marginLeft: 8,
    flex: 1,
  },
  form: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  footerLink: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 12,
  },
  successText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  demoBox: {
    marginTop: 24,
    padding: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  demoLabel: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
});
