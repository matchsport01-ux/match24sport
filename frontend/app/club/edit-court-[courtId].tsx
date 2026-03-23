// Edit Court Screen - Hidden from tabs
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input, Card } from '../../src/components';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { COLORS, SPORTS } from '../../src/utils/constants';
import { apiClient } from '../../src/api/client';
import { LoadingSpinner } from '../../src/components/LoadingSpinner';
import { successHaptic } from '../../src/utils/haptics';

export default function EditCourtScreen() {
  const router = useRouter();
  const { courtId } = useLocalSearchParams<{ courtId: string }>();
  const { t } = useLanguage();

  const [court, setCourt] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState('');
  const [sport, setSport] = useState('');
  const [surfaceType, setSurfaceType] = useState('');
  const [isIndoor, setIsIndoor] = useState(false);
  const [pricePerHour, setPricePerHour] = useState('');

  useEffect(() => {
    fetchCourt();
  }, [courtId]);

  const fetchCourt = async () => {
    try {
      const courts = await apiClient.getClubCourts();
      const foundCourt = courts.find((c: any) => c.court_id === courtId);
      if (foundCourt) {
        setCourt(foundCourt);
        setName(foundCourt.name || '');
        setSport(foundCourt.sport || '');
        setSurfaceType(foundCourt.surface_type || '');
        setIsIndoor(foundCourt.is_indoor || false);
        setPricePerHour(foundCourt.price_per_hour?.toString() || '');
      } else {
        Alert.alert('Errore', 'Campo non trovato');
        router.back();
      }
    } catch (error) {
      console.error('Error fetching court:', error);
      Alert.alert('Errore', 'Impossibile caricare i dati del campo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name || !sport) {
      Alert.alert('Errore', 'Compila tutti i campi obbligatori');
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.updateCourt(courtId!, {
        name,
        sport,
        surface_type: surfaceType,
        is_indoor: isIndoor,
        price_per_hour: parseFloat(pricePerHour) || 0,
      });
      successHaptic();
      Alert.alert('Successo', 'Campo aggiornato');
      router.back();
    } catch (error) {
      Alert.alert('Errore', 'Impossibile salvare le modifiche');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Modifica Campo</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Input
            label="Nome Campo *"
            placeholder="Es. Campo 1"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Sport *</Text>
          <View style={styles.sportsRow}>
            {SPORTS.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.sportOption,
                  sport === s.id && { borderColor: s.color, backgroundColor: s.color + '20' },
                ]}
                onPress={() => setSport(s.id)}
              >
                <Ionicons
                  name={s.id === 'calcetto' || s.id === 'calcio8' ? 'football-outline' : 'tennisball-outline'}
                  size={24}
                  color={sport === s.id ? s.color : COLORS.textMuted}
                />
                <Text style={[styles.sportText, sport === s.id && { color: s.color }]}>
                  {s.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label="Tipo Superficie"
            placeholder="Es. Erba sintetica"
            value={surfaceType}
            onChangeText={setSurfaceType}
          />

          <Text style={styles.label}>Tipo</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeOption, !isIndoor && styles.typeOptionSelected]}
              onPress={() => setIsIndoor(false)}
            >
              <Ionicons name="sunny-outline" size={24} color={!isIndoor ? COLORS.primary : COLORS.textMuted} />
              <Text style={[styles.typeText, !isIndoor && { color: COLORS.primary }]}>Outdoor</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeOption, isIndoor && styles.typeOptionSelected]}
              onPress={() => setIsIndoor(true)}
            >
              <Ionicons name="home-outline" size={24} color={isIndoor ? COLORS.primary : COLORS.textMuted} />
              <Text style={[styles.typeText, isIndoor && { color: COLORS.primary }]}>Indoor</Text>
            </TouchableOpacity>
          </View>

          <Input
            label="Prezzo orario (€)"
            placeholder="0"
            value={pricePerHour}
            onChangeText={setPricePerHour}
            keyboardType="numeric"
          />

          <Button
            title="Salva Modifiche"
            onPress={handleSave}
            loading={isSaving}
            fullWidth
            size="large"
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
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  scrollContent: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  sportsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  sportOption: {
    width: '47%',
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  sportText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  typeOption: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  typeText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 8,
  },
});
