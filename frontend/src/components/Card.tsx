// Card Component - Modern Glass UI
import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SHADOWS, BORDER_RADIUS } from '../utils/constants';
import { lightHaptic } from '../utils/haptics';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  variant?: 'default' | 'elevated' | 'outlined' | 'glass' | 'gradient';
  gradientColors?: string[];
  noPadding?: boolean;
}

export function Card({ 
  children, 
  style, 
  onPress, 
  variant = 'default',
  gradientColors,
  noPadding = false,
}: CardProps) {
  const getCardStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: COLORS.surfaceElevated,
          ...SHADOWS.large,
        };
      case 'outlined':
        return {
          backgroundColor: COLORS.surface,
          borderWidth: 1,
          borderColor: COLORS.border,
        };
      case 'glass':
        return {
          backgroundColor: COLORS.glass,
          borderWidth: 1,
          borderColor: COLORS.glassBorder,
        };
      case 'gradient':
        return {};
      default:
        return {
          backgroundColor: COLORS.surface,
          ...SHADOWS.small,
        };
    }
  };

  const handlePress = () => {
    if (onPress) {
      lightHaptic();
      onPress();
    }
  };

  const cardStyles = [
    styles.card,
    getCardStyle(),
    noPadding && styles.noPadding,
    style,
  ];

  if (variant === 'gradient') {
    const colors = gradientColors || ['rgba(0, 214, 143, 0.15)', 'rgba(0, 179, 119, 0.05)'];
    const content = (
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, styles.gradientCard, noPadding && styles.noPadding, style]}
      >
        {children}
      </LinearGradient>
    );

    if (onPress) {
      return (
        <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
          {content}
        </TouchableOpacity>
      );
    }
    return content;
  }

  const content = <View style={cardStyles}>{children}</View>;

  if (onPress) {
    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: 20,
  },
  gradientCard: {
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  noPadding: {
    padding: 0,
  },
});
