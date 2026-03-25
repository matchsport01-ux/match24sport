// Delete Account Screen - Apple Guideline 5.1.1(v) Compliance
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card } from '../../src/components';
import { useAuth } from '../../src/contexts/AuthContext';
import { COLORS } from '../../src/utils/constants';
import { lightHaptic, errorHaptic, successHaptic } from '../../src/utils/haptics';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { user, deleteAccount } = useAuth();

  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleDeleteAccount = async () => {
    // Validate password
    if (!password.trim()) {
      setError('Please enter your password to confirm deletion.');
      errorHaptic();
      return;
    }

    // Show final confirmation alert
    Alert.alert(
      'Delete Account',
      'This action is PERMANENT and cannot be undone. All your data will be deleted. Are you absolutely sure?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => lightHaptic(),
        },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            setError('');
            
            try {
              const result = await deleteAccount(password);
              
              if (result.success) {
                successHaptic();
                Alert.alert(
                  'Account Deleted',
                  'Your account has been deleted successfully.',
                  [
                    {
                      text: 'OK',
                      onPress: () => router.replace('/'),
                    },
                  ]
                );
              }
            } catch (err: any) {
              errorHaptic();
              
              // Handle specific error codes
              if (err.response?.status === 401) {
                setError('Incorrect password. Please try again.');
              } else if (err.response?.status === 404) {
                setError('Account not found. Please contact support.');
              } else if (err.response?.data?.detail) {
                setError(err.response.data.detail);
              } else {
                setError('An error occurred. Please try again or contact support.');
              }
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Warning Header */}
          <View style={styles.warningHeader}>
            <View style={styles.warningIconContainer}>
              <Ionicons name="warning" size={48} color={COLORS.error} />
            </View>
            <Text style={styles.warningTitle}>Delete Account</Text>
            <Text style={styles.warningSubtitle}>
              This action is permanent and cannot be undone.
            </Text>
          </View>

          {/* Information Card */}
          <Card style={styles.infoCard}>
            <Text style={styles.infoTitle}>What will happen:</Text>
            
            <View style={styles.infoRow}>
              <Ionicons name="trash-outline" size={20} color={COLORS.error} />
              <Text style={styles.infoText}>
                Your personal data will be permanently deleted
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <Ionicons name="person-remove-outline" size={20} color={COLORS.error} />
              <Text style={styles.infoText}>
                Your profile and account will be removed
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <Ionicons name="chatbubbles-outline" size={20} color={COLORS.error} />
              <Text style={styles.infoText}>
                Your messages will be anonymized
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <Ionicons name="star-outline" size={20} color={COLORS.error} />
              <Text style={styles.infoText}>
                Your ratings will be anonymized for historical integrity
              </Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.infoRow}>
              <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.textSecondary} />
              <Text style={[styles.infoText, { color: COLORS.textSecondary }]}>
                Some data may be retained for legal, security, or fraud-prevention purposes.
              </Text>
            </View>
          </Card>

          {/* Password Confirmation */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Confirm your password</Text>
            <Text style={styles.sectionSubtitle}>
              Enter your password to confirm account deletion
            </Text>
            
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setError('');
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isDeleting}
              />
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={COLORS.textMuted}
                onPress={() => setShowPassword(!showPassword)}
              />
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Button
              title="Cancel"
              onPress={() => {
                lightHaptic();
                router.back();
              }}
              variant="secondary"
              disabled={isDeleting}
              style={styles.cancelButton}
            />
            
            <Button
              title={isDeleting ? 'Deleting...' : 'Delete My Account'}
              onPress={handleDeleteAccount}
              variant="danger"
              loading={isDeleting}
              disabled={isDeleting || !password.trim()}
              style={styles.deleteButton}
            />
          </View>

          {/* Legal Notice */}
          <Text style={styles.legalNotice}>
            By deleting your account, you acknowledge that this action is irreversible. 
            If you have any subscriptions, please cancel them first through the respective app store.
          </Text>
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
    padding: 16,
    paddingBottom: 32,
  },
  warningHeader: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 16,
  },
  warningIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.error,
    marginBottom: 8,
  },
  warningSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  infoCard: {
    marginBottom: 24,
    backgroundColor: COLORS.surface,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    marginLeft: 12,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    marginLeft: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    marginLeft: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  cancelButton: {
    flex: 1,
  },
  deleteButton: {
    flex: 1,
  },
  legalNotice: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
