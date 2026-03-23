// Club Edit Profile Screen with Photo Upload
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button, Input, Card } from '../../src/components';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { COLORS } from '../../src/utils/constants';
import { apiClient } from '../../src/api/client';
import { Club } from '../../src/types';
import { successHaptic } from '../../src/utils/haptics';

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
      quality: 0.5,  // Reduced quality for smaller file size
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setIsUploadingPhoto(true);
      try {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        
        // Check if image is too large (> 2MB in base64)
        if (base64Image.length > 2 * 1024 * 1024) {
          Alert.alert('Errore', 'L\'immagine è troppo grande. Prova con un\'immagine più piccola.');
          setIsUploadingPhoto(false);
          return;
        }
        
        // Upload to backend
        await apiClient.updateClub({ logo: base64Image });
        setLogo(base64Image);
        successHaptic();
        Alert.alert('Successo', 'Foto del circolo aggiornata');
      } catch (error: any) {
        console.error('Error uploading photo:', error);
        Alert.alert('Errore', error.response?.data?.detail || 'Impossibile caricare la foto. Prova con un\'immagine più piccola.');
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
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setIsUploadingPhoto(true);
      try {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        
        // Upload to backend
        await apiClient.updateClub({ logo: base64Image });
        setLogo(base64Image);
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
    if (!name || !address || !city) {
      Alert.alert('Errore', 'Nome, indirizzo e città sono obbligatori');
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.updateClub({
        name,
        description: description || null,
        address,
        city,
        phone: phone || null,
        email: email || null,
        website: website || null,
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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
          
          <Input
            label="Nome Circolo *"
            value={name}
            onChangeText={setName}
            placeholder="Es. Tennis Club Milano"
          />

          <Input
            label="Descrizione"
            value={description}
            onChangeText={setDescription}
            placeholder="Descrivi il tuo circolo..."
            multiline
            numberOfLines={3}
          />

          <Input
            label="Indirizzo *"
            value={address}
            onChangeText={setAddress}
            placeholder="Via Roma 1"
          />

          <Input
            label="Città *"
            value={city}
            onChangeText={setCity}
            placeholder="Milano"
          />

          <Input
            label="Telefono"
            value={phone}
            onChangeText={setPhone}
            placeholder="+39 02 1234567"
            keyboardType="phone-pad"
          />

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="info@tuocircolo.it"
            keyboardType="email-address"
          />

          <Input
            label="Sito Web"
            value={website}
            onChangeText={setWebsite}
            placeholder="https://www.tuocircolo.it"
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
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  clubPhoto: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  uploadingText: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.secondary,
  },
  photoEditBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoHint: {
    marginTop: 12,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  formCard: {
    marginBottom: 16,
  },
  saveButton: {
    marginTop: 8,
  },
});
