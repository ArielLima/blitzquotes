import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';

export default function OnboardingBusinessScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { trade } = useLocalSearchParams<{ trade: string }>();
  const { user, setSettings, setIsOnboarded } = useStore();

  const [businessName, setBusinessName] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid = businessName.trim().length > 0 && /^\d{5}$/.test(zipCode);

  const handleFinish = async () => {
    if (!user || !isValid) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .insert({
          user_id: user.id,
          trade: trade || 'general',
          business_name: businessName.trim(),
          zip_code: zipCode,
          default_tax_rate: 0,
          default_markup: 0.35,
          payment_method: 'none',
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setSettings(data);
        setIsOnboarded(true);
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F9FAFB' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
        </TouchableOpacity>
        <Text style={[styles.step, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
          Step 2 of 2
        </Text>
        <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#111827' }]}>
          Tell us about your business
        </Text>
        <Text style={[styles.subtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
          This helps us personalize quotes and pricing for your area
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: isDark ? '#D1D5DB' : '#374151' }]}>
            Business Name
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                color: isDark ? '#FFFFFF' : '#111827',
                borderColor: isDark ? '#374151' : '#E5E7EB',
              },
            ]}
            placeholder="e.g., Smith Plumbing LLC"
            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
            value={businessName}
            onChangeText={setBusinessName}
            autoFocus
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: isDark ? '#D1D5DB' : '#374151' }]}>
            ZIP Code
          </Text>
          <Text style={[styles.labelHint, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
            Used for regional pricing estimates
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.zipInput,
              {
                backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                color: isDark ? '#FFFFFF' : '#111827',
                borderColor: isDark ? '#374151' : '#E5E7EB',
              },
            ]}
            placeholder="12345"
            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
            value={zipCode}
            onChangeText={(text) => setZipCode(text.replace(/\D/g, '').slice(0, 5))}
            keyboardType="number-pad"
            maxLength={5}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <View style={[styles.infoBox, { backgroundColor: isDark ? '#1F2937' : '#EFF6FF' }]}>
          <FontAwesome name="lightbulb-o" size={20} color="#3B82F6" />
          <Text style={[styles.infoText, { color: isDark ? '#9CA3AF' : '#1E40AF' }]}>
            Your pricebook will build automatically as you create quotes. No setup needed!
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.finishButton,
            !isValid && styles.finishButtonDisabled,
          ]}
          onPress={handleFinish}
          disabled={!isValid || loading}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.finishButtonText}>Get Started</Text>
              <FontAwesome name="check" size={16} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 16,
    marginLeft: -8,
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
  form: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 24,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  labelHint: {
    fontSize: 13,
    marginTop: -4,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 17,
  },
  zipInput: {
    width: 120,
  },
  footer: {
    padding: 24,
    paddingBottom: 48,
    gap: 16,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  finishButton: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: '#10B981',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  finishButtonDisabled: {
    backgroundColor: '#6EE7B7',
  },
  finishButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
