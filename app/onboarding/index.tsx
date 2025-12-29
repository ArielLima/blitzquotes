import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  useColorScheme,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const { width } = Dimensions.get('window');

const TRADES = [
  {
    id: 'plumbing',
    label: 'Plumbing',
    icon: 'tint',
    description: 'Water heaters, pipes, fixtures',
    gradient: ['#3B82F6', '#1D4ED8'],
  },
  {
    id: 'hvac',
    label: 'HVAC',
    icon: 'snowflake-o',
    description: 'Heating, cooling, ventilation',
    gradient: ['#06B6D4', '#0891B2'],
  },
  {
    id: 'electrical',
    label: 'Electrical',
    icon: 'bolt',
    description: 'Panels, wiring, fixtures',
    gradient: ['#F59E0B', '#D97706'],
  },
  {
    id: 'general',
    label: 'General',
    icon: 'wrench',
    description: 'Remodeling, repairs, handyman',
    gradient: ['#8B5CF6', '#7C3AED'],
  },
];

export default function OnboardingTradeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [selectedTrade, setSelectedTrade] = useState<string | null>(null);

  const handleContinue = () => {
    if (selectedTrade) {
      router.push({ pathname: '/onboarding/business', params: { trade: selectedTrade } });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F9FAFB' }]}>
      <View style={styles.header}>
        <Text style={[styles.step, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
          Step 1 of 2
        </Text>
        <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#111827' }]}>
          What's your trade?
        </Text>
        <Text style={[styles.subtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
          We'll customize your experience based on your specialty
        </Text>
      </View>

      <View style={styles.trades}>
        {TRADES.map((trade) => {
          const isSelected = selectedTrade === trade.id;
          return (
            <TouchableOpacity
              key={trade.id}
              style={[
                styles.tradeCard,
                isSelected && styles.tradeCardSelected,
                {
                  backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                  borderColor: isSelected ? trade.gradient[0] : 'transparent',
                },
              ]}
              onPress={() => setSelectedTrade(trade.id)}
              activeOpacity={0.7}>
              <LinearGradient
                colors={isSelected ? trade.gradient : [isDark ? '#374151' : '#F3F4F6', isDark ? '#374151' : '#F3F4F6']}
                style={styles.iconContainer}>
                <FontAwesome
                  name={trade.icon as any}
                  size={24}
                  color={isSelected ? '#FFFFFF' : (isDark ? '#9CA3AF' : '#6B7280')}
                />
              </LinearGradient>
              <View style={styles.tradeInfo}>
                <Text style={[
                  styles.tradeLabel,
                  { color: isDark ? '#FFFFFF' : '#111827' },
                  isSelected && { color: trade.gradient[0] }
                ]}>
                  {trade.label}
                </Text>
                <Text style={[styles.tradeDescription, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
                  {trade.description}
                </Text>
              </View>
              {isSelected && (
                <FontAwesome name="check-circle" size={24} color={trade.gradient[0]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            !selectedTrade && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!selectedTrade}>
          <Text style={styles.continueButtonText}>Continue</Text>
          <FontAwesome name="arrow-right" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 32,
  },
  step: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  trades: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 12,
  },
  tradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tradeCardSelected: {
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tradeInfo: {
    flex: 1,
    marginLeft: 16,
  },
  tradeLabel: {
    fontSize: 17,
    fontWeight: '600',
  },
  tradeDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  footer: {
    padding: 24,
    paddingBottom: 48,
  },
  continueButton: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  continueButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
