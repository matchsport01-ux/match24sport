// Edit Profile Screen
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button, Input, Card, LoadingSpinner } from '../../src/components';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { COLORS, SPORTS, SKILL_LEVELS } from '../../src/utils/constants';
import { apiClient } from '../../src/api/client';
import { PlayerProfile } from '../../src/types';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [city, setCity] = useState('');
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [skillLevels, setSkillLevels] = useState<Record<string, string>>({});
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await apiClient.getPlayerProfile();
        setProfile(data);
        setCity(data.city || '');
        setNickname(data.nickname || '');
        setBio(data.bio || '');
        setSelectedSports(data.preferred_sports || []);
        setSkillLevels(data.skill_levels || {});
        setProfilePicture(data.profile_picture || null);
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permesso necessario', 'Abbiamo bisogno del permesso per accedere alle foto.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setProfilePicture(base64Image);
    }
  };

  const toggleSport = (sportId: string) => {
    setSelectedSports((prev) =>
      prev.includes(sportId)
        ? prev.filter((s) => s !== sportId)
        : [...prev, sportId]
    );
  };

  const setSkillLevel = (sport: string, level: string) => {
    setSkillLevels((prev) => ({ ...prev, [sport]: level }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiClient.updatePlayerProfile({
        city,
        nickname,
        bio,
        preferred_sports: selectedSports,
        skill_levels: skillLevels,
        profile_picture: profilePicture,
      });
      router.back();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Errore', 'Impossibile salvare il profilo');
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
        <Text style={styles.title}>{t('edit')} {t('profile')}</Text>
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
          {/* Profile Picture */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={pickImage}>
              {profilePicture ? (
                <Image source={{ uri: profilePicture }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={48} color={COLORS.textMuted} />
                </View>
              )}
              <View style={styles.editAvatarButton}>
                <Ionicons name="camera" size={16} color={COLORS.text} />
              </View>
            </TouchableOpacity>
            <Text style={styles.changePhotoText}>Cambia foto</Text>
          </View>

          {/* Basic Info */}
          <View style={styles.section}>
            <Input
              label={t('city')}
              placeholder="Es. Milano"
              value={city}
              onChangeText={setCity}
              leftIcon="location-outline"
            />
            <Input
              label={t('nickname')}
              placeholder="Il tuo soprannome in campo"
              value={nickname}
              onChangeText={setNickname}
              leftIcon="at-outline"
            />
            <Input
              label={t('bio')}
              placeholder="Presentati agli altri giocatori..."
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
              leftIcon="document-text-outline"
            />
          </View>

          {/* Sports Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('preferred_sports')}</Text>
            <View style={styles.sportsGrid}>
              {SPORTS.map((sport) => (
                <TouchableOpacity
                  key={sport.id}
                  style={[
                    styles.sportCard,
                    selectedSports.includes(sport.id) && {
                      borderColor: sport.color,
                      backgroundColor: sport.color + '20',
                    },
                  ]}
                  onPress={() => toggleSport(sport.id)}
                >
                  <Ionicons
                    name={sport.id === 'calcetto' ? 'football-outline' : 'tennisball-outline'}
                    size={24}
                    color={selectedSports.includes(sport.id) ? sport.color : COLORS.textMuted}
                  />
                  <Text
                    style={[
                      styles.sportCardText,
                      selectedSports.includes(sport.id) && { color: sport.color },
                    ]}
                  >
                    {sport.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Skill Levels */}
          {selectedSports.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('level')}</Text>
              {selectedSports.map((sportId) => {
                const sport = SPORTS.find((s) => s.id === sportId)!;
                return (
                  <Card key={sportId} style={styles.levelCard}>
                    <Text style={styles.levelCardTitle}>{sport.name}</Text>
                    <View style={styles.levelOptions}>
                      {SKILL_LEVELS.filter((l) => l.id !== 'all').map((level) => (
                        <TouchableOpacity
                          key={level.id}
                          style={[
                            styles.levelOption,
                            skillLevels[sportId] === level.id && {
                              backgroundColor: sport.color,
                            },
                          ]}
                          onPress={() => setSkillLevel(sportId, level.id)}
                        >
                          <Text
                            style={[
                              styles.levelOptionText,
                              skillLevels[sportId] === level.id && { color: COLORS.text },
                            ]}
                          >
                            {level.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </Card>
                );
              })}
            </View>
          )}

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
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoText: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  sportsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  sportCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  sportCardText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 8,
  },
  levelCard: {
    marginBottom: 12,
  },
  levelCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  levelOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  levelOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
  },
  levelOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  submitButton: {
    marginTop: 8,
  },
});
