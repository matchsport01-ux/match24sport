// Create Match Screen
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
import { Card, Button, Input, LoadingSpinner } from '../../src/components';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { COLORS, SPORTS, SKILL_LEVELS, MATCH_FORMATS } from '../../src/utils/constants';
import { apiClient } from '../../src/api/client';
import { Court } from '../../src/types';
import { format, addDays } from 'date-fns';

export default function CreateMatchScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  const [courts, setCourts] = useState<Court[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [skillLevel, setSkillLevel] = useState('all');
  const [maxPlayers, setMaxPlayers] = useState('4');
  const [pricePerPlayer, setPricePerPlayer] = useState('0');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const fetchCourts = async () => {
      try {
        const data = await apiClient.getClubCourts();
        setCourts(data.filter((c: Court) => c.is_active));
        if (data.length > 0) {
          setSelectedCourt(data[0]);
          // Set default max players based on sport
          const sportFormat = MATCH_FORMATS[data[0].sport as keyof typeof MATCH_FORMATS];
          if (sportFormat) {
            setMaxPlayers(sportFormat.maxPlayers.toString());
          }
        }
      } catch (error) {
        console.error('Error fetching courts:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCourts();
  }, []);

  const handleCourtSelect = (court: Court) => {
    setSelectedCourt(court);
    const sportFormat = MATCH_FORMATS[court.sport as keyof typeof MATCH_FORMATS];
    if (sportFormat) {
      setMaxPlayers(sportFormat.maxPlayers.toString());
    }
  };

  const handleSubmit = async () => {
    if (!selectedCourt) {
      Alert.alert('Errore', 'Seleziona un campo');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.createMatch({
        sport: selectedCourt.sport,
        format: selectedCourt.sport,
        court_id: selectedCourt.court_id,
        date: format(selectedDate, 'yyyy-MM-dd'),
        start_time: startTime,
        end_time: endTime,
        max_players: parseInt(maxPlayers),
        skill_level: skillLevel,
        price_per_player: parseFloat(pricePerPlayer) || 0,
        notes: notes || undefined,
      });
      Alert.alert(t('success'), t('match_created'), [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Impossibile creare la partita');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate next 14 days for date selection
  const dateOptions = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));

  // Time slots
  const timeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
    '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00',
  ];

  if (isLoading) {
    return <LoadingSpinner fullScreen message={t('loading')} />;
  }

  if (courts.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('create_match')}</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="tennisball-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Nessun campo disponibile</Text>
          <Text style={styles.emptySubtitle}>Aggiungi prima un campo per poter creare partite</Text>
          <Button
            title={t('add_court')}
            onPress={() => router.push('/club/add-court')}
            style={{ marginTop: 24 }}
          />
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
        <Text style={styles.headerTitle}>{t('create_match')}</Text>
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
          {/* Court Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Campo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.courtsRow}>
                {courts.map((court) => {
                  const sport = SPORTS.find((s) => s.id === court.sport);
                  return (
                    <TouchableOpacity
                      key={court.court_id}
                      style={[
                        styles.courtOption,
                        selectedCourt?.court_id === court.court_id && {
                          borderColor: sport?.color || COLORS.primary,
                          backgroundColor: (sport?.color || COLORS.primary) + '20',
                        },
                      ]}
                      onPress={() => handleCourtSelect(court)}
                    >
                      <Ionicons
                        name={court.sport === 'calcetto' ? 'football-outline' : 'tennisball-outline'}
                        size={24}
                        color={sport?.color || COLORS.primary}
                      />
                      <Text style={styles.courtName}>{court.name}</Text>
                      <Text style={[styles.courtSport, { color: sport?.color }]}>
                        {sport?.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Date Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('date')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.datesRow}>
                {dateOptions.map((date, index) => {
                  const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.dateOption,
                        isSelected && styles.dateOptionSelected,
                      ]}
                      onPress={() => setSelectedDate(date)}
                    >
                      <Text style={[
                        styles.dateDay,
                        isSelected && styles.dateDaySelected,
                      ]}>
                        {format(date, 'EEE').slice(0, 3)}
                      </Text>
                      <Text style={[
                        styles.dateNum,
                        isSelected && styles.dateNumSelected,
                      ]}>
                        {format(date, 'd')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Time Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('time')}</Text>
            <View style={styles.timeRow}>
              <View style={styles.timeSelect}>
                <Text style={styles.timeLabel}>Inizio</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.timeSlotsRow}>
                    {timeSlots.map((time) => (
                      <TouchableOpacity
                        key={`start-${time}`}
                        style={[
                          styles.timeSlot,
                          startTime === time && styles.timeSlotSelected,
                        ]}
                        onPress={() => setStartTime(time)}
                      >
                        <Text style={[
                          styles.timeSlotText,
                          startTime === time && styles.timeSlotTextSelected,
                        ]}>
                          {time}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
              <View style={styles.timeSelect}>
                <Text style={styles.timeLabel}>Fine</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.timeSlotsRow}>
                    {timeSlots.map((time) => (
                      <TouchableOpacity
                        key={`end-${time}`}
                        style={[
                          styles.timeSlot,
                          endTime === time && styles.timeSlotSelected,
                        ]}
                        onPress={() => setEndTime(time)}
                      >
                        <Text style={[
                          styles.timeSlotText,
                          endTime === time && styles.timeSlotTextSelected,
                        ]}>
                          {time}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>
          </View>

          {/* Skill Level */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('level')}</Text>
            <View style={styles.levelGrid}>
              {SKILL_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level.id}
                  style={[
                    styles.levelOption,
                    skillLevel === level.id && styles.levelOptionSelected,
                  ]}
                  onPress={() => setSkillLevel(level.id)}
                >
                  <Text style={[
                    styles.levelText,
                    skillLevel === level.id && styles.levelTextSelected,
                  ]}>
                    {level.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Max Players & Price */}
          <View style={styles.rowInputs}>
            <Input
              label="Max Giocatori"
              placeholder="4"
              value={maxPlayers}
              onChangeText={setMaxPlayers}
              keyboardType="number-pad"
              containerStyle={{ flex: 1, marginRight: 8 }}
            />
            <Input
              label={`${t('price')} (\u20AC)`}
              placeholder="0"
              value={pricePerPlayer}
              onChangeText={setPricePerPlayer}
              keyboardType="decimal-pad"
              containerStyle={{ flex: 1, marginLeft: 8 }}
            />
          </View>

          {/* Notes */}
          <Input
            label="Note (opzionale)"
            placeholder="Es. Palle fornite, porta scarpe pulite..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          <Button
            title={t('create_match')}
            onPress={handleSubmit}
            loading={isSubmitting}
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
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
  courtsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  courtOption: {
    width: 120,
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  courtName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 8,
  },
  courtSport: {
    fontSize: 12,
    marginTop: 4,
  },
  datesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateOption: {
    width: 56,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  dateOptionSelected: {
    backgroundColor: COLORS.secondary,
  },
  dateDay: {
    fontSize: 12,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  dateDaySelected: {
    color: COLORS.text,
  },
  dateNum: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 4,
  },
  dateNumSelected: {
    color: COLORS.text,
  },
  timeRow: {
    gap: 16,
  },
  timeSelect: {
    marginBottom: 12,
  },
  timeLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  timeSlotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timeSlot: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
  },
  timeSlotSelected: {
    backgroundColor: COLORS.secondary,
  },
  timeSlotText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  timeSlotTextSelected: {
    color: COLORS.text,
  },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  levelOption: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  levelOptionSelected: {
    backgroundColor: COLORS.secondary,
  },
  levelText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  levelTextSelected: {
    color: COLORS.text,
  },
  rowInputs: {
    flexDirection: 'row',
  },
  submitButton: {
    marginTop: 16,
  },
});
