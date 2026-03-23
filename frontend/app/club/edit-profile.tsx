// Club Edit Profile Screen - Fixed Image Upload and Name Field
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Button, Card } from '../../src/components';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { COLORS } from '../../src/utils/constants';
import { apiClient } from '../../src/api/client';
import { Club } from '../../src/types';
import { successHaptic } from '../../src/utils/haptics';

// Custom Input that works better on iOS for all fields
function ClubInput({ 
  label, 
  value, 
  onChangeText, 
  placeholder,
  multiline = false,
  keyboardType = 'default',
  required = false,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'url';
  required?: boolean;
}) {
  const [isFocused, setIsFocused] = useState(false);
  
  return (
    <View style={inputStyles.container}>
      <Text style={inputStyles.label}>
        {label}{required ? ' *' : ''}
      </Text>
      <View style={[
        inputStyles.inputContainer,
        isFocused && inputStyles.inputFocused,
      ]}>
        <TextInput
          style={[
            inputStyles.input,
            multiline && inputStyles.multilineInput,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          keyboardType={keyboardType}
          // Prevent iOS autofill completely
          autoCorrect={false}
          autoCapitalize="none"
          autoComplete="off"
          textContentType="none"
          spellCheck={false}
        />
      </View>
    </View>
  );
}

const inputStyles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  inputContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
  },
  inputFocused: {
    borderColor: COLORS.secondary,
    borderWidth: 2,
  },
  input: {
    color: COLORS.text,
    fontSize: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});

export default function EditClubProfileScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  const [club, setClub] = useState<Club | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  useEffect(() => {
    fetchClub();
  }, []);

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
      setLogo(data.logo || null);
    } catch (error) {
      console.error('Error fetching club:', error);
      Alert.alert('Errore', 'Impossibile caricare i dati del circolo');
    } finally {
      setIsLoading(false);
    }
  };

  const compressImage = async (uri: string): Promise<string> => {
    try {
      // Resize and compress the image
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],  // Max width 800px
        { 
          compress: 0.6,  // 60% quality
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );
      
      return `data:image/jpeg;base64,${manipulated.base64}`;
    } catch (error) {
      console.error('Error compressing image:', error);
      throw error;
    }
  };

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permesso negato', 'È necessario il permesso per accedere alla galleria');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,  // Initial quality
    });

    if (!result.canceled && result.assets[0]) {
      setIsUploadingPhoto(true);
      try {
        // Compress the image before uploading
        const compressedBase64 = await compressImage(result.assets[0].uri);
        
        console.log('[Upload] Compressed image size:', Math.round(compressedBase64.length / 1024), 'KB');
        
        // Upload to backend
        await apiClient.updateClub({ logo: compressedBase64 });
        setLogo(compressedBase64);
        successHaptic();
        Alert.alert('Successo', 'Foto del circolo aggiornata');
      } catch (error: any) {
        console.error('Error uploading photo:', error);
        Alert.alert(
          'Errore', 
          error.response?.data?.detail || 'Impossibile caricare la foto. Prova con un\'immagine più piccola.'
        );
      } finally {
        setIsUploadingPhoto(false);
      }
    }
  };

  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permesso negato', 'È necessario il permesso per usare la fotocamera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setIsUploadingPhoto(true);
      try {
        const compressedBase64 = await compressImage(result.assets[0].uri);
        
        await apiClient.updateClub({ logo: compressedBase64 });
        setLogo(compressedBase64);
        successHaptic();
        Alert.alert('Successo', 'Foto del circolo aggiornata');
      } catch (error) {
        console.error('Error uploading photo:', error);
        Alert.alert('Errore', 'Impossibile caricare la foto');
      } finally {
        setIsUploadingPhoto(false);
      }
    }
  };

  const showPhotoOptions = () => {
    Alert.alert(
      'Foto del Circolo',
      'Come vuoi aggiungere la foto?',
      [
        { text: 'Scatta una foto', onPress: handleTakePhoto },
        { text: 'Scegli dalla galleria', onPress: handlePickImage },
        { text: 'Annulla', style: 'cancel' },
      ]
    );
  };

  const handleSave = async () => {
    if (!name.trim() || !address.trim() || !city.trim()) {
      Alert.alert('Errore', 'Nome, indirizzo e città sono obbligatori');
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.updateClub({
        name: name.trim(),
        description: description.trim() || null,
        address: address.trim(),
        city: city.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        website: website.trim() || null,
      });
      successHaptic();
      Alert.alert('Successo', 'Profilo aggiornato con successo', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Impossibile aggiornare il profilo');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.secondary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Modifica Circolo</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Club Photo */}
          <Card style={styles.photoCard}>
            <Text style={styles.sectionTitle}>Foto del Circolo</Text>
            <TouchableOpacity 
              style={styles.photoContainer} 
              onPress={showPhotoOptions}
              disabled={isUploadingPhoto}
            >
              {isUploadingPhoto ? (
                <View style={styles.photoPlaceholder}>
                  <ActivityIndicator size="large" color={COLORS.secondary} />
                  <Text style={styles.uploadingText}>Caricamento...</Text>
                </View>
              ) : logo ? (
                <Image source={{ uri: logo }} style={styles.clubPhoto} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera-outline" size={48} color={COLORS.textMuted} />
                  <Text style={styles.photoPlaceholderText}>Aggiungi foto</Text>
                </View>
              )}
              <View style={styles.photoEditBadge}>
                <Ionicons name="pencil" size={16} color={COLORS.background} />
              </View>
            </TouchableOpacity>
            <Text style={styles.photoHint}>
              Tocca per aggiungere o modificare la foto del tuo circolo
            </Text>
          </Card>

          {/* Club Info */}
          <Card style={styles.formCard}>
            <Text style={styles.sectionTitle}>Informazioni</Text>
            
            <ClubInput
              label="Nome Circolo"
              value={name}
              onChangeText={setName}
              placeholder="Es. Tennis Club Milano"
              required
            />

            <ClubInput
              label="Descrizione"
              value={description}
              onChangeText={setDescription}
              placeholder="Descrivi il tuo circolo..."
              multiline
            />

            <ClubInput
              label="Indirizzo"
              value={address}
              onChangeText={setAddress}
              placeholder="Via Roma 1"
              required
            />

            <ClubInput
              label="Città"
              value={city}
              onChangeText={setCity}
              placeholder="Milano"
              required
            />

            <ClubInput
              label="Telefono"
              value={phone}
              onChangeText={setPhone}
              placeholder="+39 02 1234567"
              keyboardType="phone-pad"
            />

            <ClubInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="info@tuocircolo.it"
              keyboardType="email-address"
            />

            <ClubInput
              label="Sito Web"
              value={website}
              onChangeText={setWebsite}
              placeholder="https://www.tuocircolo.it"
              keyboardType="url"
            />
          </Card>

          <Button
            title="Salva Modifiche"
            onPress={handleSave}
            loading={isSaving}
            fullWidth
            size="large"
            style={styles.saveButton}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  photoCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  photoContainer: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
    overflow: 'hidden',
  },
  clubPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 8,
  },
  uploadingText: {
    fontSize: 14,
    color: COLORS.secondary,
    marginTop: 8,
  },
  photoEditBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
  formCard: {
    marginBottom: 16,
  },
  saveButton: {
    marginTop: 8,
  },
});
