// Club Edit Profile Screen
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input, LoadingSpinner } from '../../src/components';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { COLORS } from '../../src/utils/constants';
import { apiClient } from '../../src/api/client';
import { Club } from '../../src/types';

export default function ClubEditProfileScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  const [club, setClub] = useState<Club | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');

  useEffect(() => {
    const fetchClub = async () => {
      try {
        const data = await apiClient.getMyClub();
        setClub(data);
        setName(data.name || '');
        setDescription(data.description || '');
        setAddress(data.address || '');
        setCity(data.city || '');
        setPhone(data.phone || '');
        setEmail(data.email || '');
        setWebsite(data.website || '');
      } catch (error) {
        console.error('Error fetching club:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchClub();
  }, []);

  const handleSave = async () => {
    if (!name || !address || !city) {
      Alert.alert('Errore', 'Compila i campi obbligatori');
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.updateMyClub({
        name,
        description: description || undefined,
        address,
        city,
        phone: phone || undefined,
        email: email || undefined,
        website: website || undefined,
      });
      Alert.alert(t('success'), t('profile_updated'));
      router.back();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Impossibile aggiornare');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message={t('loading')} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('edit')} Circolo</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Input
            label={`${t('club_name')} *`}
            placeholder="Nome del circolo"
            value={name}
            onChangeText={setName}
            leftIcon="business-outline"
          />

          <Input
            label={t('club_description')}
            placeholder="Descrivi il tuo circolo..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          <Input
            label={`${t('club_address')} *`}
            placeholder="Indirizzo completo"
            value={address}
            onChangeText={setAddress}
            leftIcon="location-outline"
          />

          <Input
            label={`${t('city')} *`}
            placeholder="Città"
            value={city}
            onChangeText={setCity}
            leftIcon="navigate-outline"
          />

          <Input
            label={t('club_phone')}
            placeholder="Telefono"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            leftIcon="call-outline"
          />

          <Input
            label={t('email')}
            placeholder="Email circolo"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail-outline"
          />

          <Input
            label="Sito Web"
            placeholder="https://"
            value={website}
            onChangeText={setWebsite}
            autoCapitalize="none"
            leftIcon="globe-outline"
          />

          <Button
            title={t('save')}
            onPress={handleSave}
            loading={isSaving}
            fullWidth
            size="large"
            style={styles.submitButton}
          />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  submitButton: {
    marginTop: 16,
  },
});
