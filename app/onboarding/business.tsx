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
  Modal,
  FlatList,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { getRegions, getStateTaxRate } from '@/lib/blitzprices';
import { PAYMENT_METHODS } from '@/lib/payments';
import type { PaymentMethod } from '@/types';
import { colors } from '@/lib/colors';

export default function OnboardingBusinessScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { trade } = useLocalSearchParams<{ trade: string }>();
  const { user, setSettings, setIsOnboarded } = useStore();

  const [businessName, setBusinessName] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('none');
  const [loading, setLoading] = useState(false);
  const [statePickerVisible, setStatePickerVisible] = useState(false);
  const [paymentPickerVisible, setPaymentPickerVisible] = useState(false);

  const regions = getRegions();
  const selectedState = regions.find(r => r.value === state);

  const handleStateChange = (stateCode: string) => {
    setState(stateCode);
    const defaultRate = getStateTaxRate(stateCode);
    setTaxRate((defaultRate * 100).toFixed(2));
  };
  const selectedPayment = PAYMENT_METHODS[paymentMethod];

  const paymentOptions = Object.entries(PAYMENT_METHODS).map(([key, val]) => ({
    value: key as PaymentMethod,
    label: val.label,
  }));

  const isValid = businessName.trim().length > 0 && state.length > 0;

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
          state: state,
          zip_code: zipCode || null,
          default_tax_rate: (parseFloat(taxRate) || 0) / 100,
          contractor_discount: 0,  // Can be set up later in Settings
          default_markup: 0.35,
          material_markup: 0.35,
          labor_rate: 100,
          payment_method: paymentMethod,
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
      style={[styles.container, { backgroundColor: isDark ? colors.background.primaryDark : colors.background.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={20} color={isDark ? colors.gray[400] : colors.text.secondary} />
        </TouchableOpacity>
        <Text style={[styles.step, { color: isDark ? colors.text.secondary : colors.gray[400] }]}>
          Step 2 of 2
        </Text>
        <Text style={[styles.title, { color: isDark ? colors.text.primaryDark : colors.gray[950] }]}>
          Tell us about your business
        </Text>
        <Text style={[styles.subtitle, { color: isDark ? colors.gray[400] : colors.text.secondary }]}>
          This helps us personalize quotes and pricing for your area
        </Text>
      </View>

      <ScrollView style={styles.form} contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: isDark ? colors.gray[300] : colors.gray[700] }]}>
            Business Name
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary,
                color: isDark ? colors.text.primaryDark : colors.gray[950],
                borderColor: isDark ? colors.gray[700] : colors.border.light,
              },
            ]}
            placeholder="e.g., Smith Plumbing LLC"
            placeholderTextColor={isDark ? colors.text.secondary : colors.gray[400]}
            value={businessName}
            onChangeText={setBusinessName}
            autoFocus
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: isDark ? colors.gray[300] : colors.gray[700] }]}>
            State
          </Text>
          <Text style={[styles.labelHint, { color: isDark ? colors.text.secondary : colors.gray[400] }]}>
            Used for regional pricing
          </Text>
          <TouchableOpacity
            style={[
              styles.dropdown,
              {
                backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary,
                borderColor: isDark ? colors.gray[700] : colors.border.light,
              },
            ]}
            onPress={() => setStatePickerVisible(true)}>
            <View style={styles.dropdownContent}>
              <FontAwesome name="map-marker" size={18} color={colors.primary.blue} style={styles.dropdownIcon} />
              <Text
                style={[
                  styles.dropdownText,
                  { color: selectedState ? (isDark ? colors.text.primaryDark : colors.gray[950]) : (isDark ? colors.text.secondary : colors.gray[400]) },
                ]}>
                {selectedState?.label || 'Select your state'}
              </Text>
            </View>
            <FontAwesome name="chevron-down" size={14} color={isDark ? colors.text.secondary : colors.gray[400]} />
          </TouchableOpacity>
        </View>

        <View style={styles.rowInputs}>
          <View style={[styles.inputContainer, { flex: 1 }]}>
            <Text style={[styles.label, { color: isDark ? colors.gray[300] : colors.gray[700] }]}>
              ZIP Code
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary,
                  color: isDark ? colors.text.primaryDark : colors.gray[950],
                  borderColor: isDark ? colors.gray[700] : colors.border.light,
                },
              ]}
              placeholder="12345"
              placeholderTextColor={isDark ? colors.text.secondary : colors.gray[400]}
              value={zipCode}
              onChangeText={(text) => setZipCode(text.replace(/\D/g, '').slice(0, 5))}
              keyboardType="number-pad"
              maxLength={5}
            />
          </View>

          <View style={[styles.inputContainer, { flex: 1 }]}>
            <Text style={[styles.label, { color: isDark ? colors.gray[300] : colors.gray[700] }]}>
              Tax Rate
            </Text>
            <View style={[
              styles.input,
              styles.taxInputWrapper,
              {
                backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary,
                borderColor: isDark ? colors.gray[700] : colors.border.light,
              },
            ]}>
              <TextInput
                style={[styles.taxInput, { color: isDark ? colors.text.primaryDark : colors.gray[950] }]}
                placeholder="0"
                placeholderTextColor={isDark ? colors.text.secondary : colors.gray[400]}
                value={taxRate}
                onChangeText={(text) => setTaxRate(text.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
              />
              <Text style={[styles.taxSuffix, { color: isDark ? colors.text.secondary : colors.gray[400] }]}>%</Text>
            </View>
          </View>
        </View>

        {state && (
          <Text style={[styles.taxHint, { color: isDark ? colors.text.secondary : colors.gray[400] }]}>
            Default for {selectedState?.label}. Adjust if your local rate differs.
          </Text>
        )}

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: isDark ? colors.gray[300] : colors.gray[700] }]}>
            How would you like to be paid?
          </Text>
          <Text style={[styles.labelHint, { color: isDark ? colors.text.secondary : colors.gray[400] }]}>
            Optional - can set up later in Settings
          </Text>
          <TouchableOpacity
            style={[
              styles.dropdown,
              {
                backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary,
                borderColor: isDark ? colors.gray[700] : colors.border.light,
              },
            ]}
            onPress={() => setPaymentPickerVisible(true)}>
            <View style={styles.dropdownContent}>
              <FontAwesome name="credit-card" size={18} color={colors.status.success} style={styles.dropdownIcon} />
              <Text
                style={[
                  styles.dropdownText,
                  { color: isDark ? colors.text.primaryDark : colors.gray[950] },
                ]}>
                {selectedPayment?.shortLabel || selectedPayment?.label || 'Select payment method'}
              </Text>
            </View>
            <FontAwesome name="chevron-down" size={14} color={isDark ? colors.text.secondary : colors.gray[400]} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={[styles.infoBox, { backgroundColor: isDark ? colors.background.secondaryDark : colors.primary.blueBg }]}>
          <FontAwesome name="database" size={20} color={colors.primary.blue} />
          <Text style={[styles.infoText, { color: isDark ? colors.gray[400] : colors.primary.blueDark }]}>
            Get real material prices from contractors in your area with BlitzPrices
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
            <ActivityIndicator color={colors.text.inverse} />
          ) : (
            <>
              <Text style={styles.finishButtonText}>Get Started</Text>
              <FontAwesome name="check" size={16} color={colors.text.inverse} />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* State Picker Modal */}
      <Modal visible={statePickerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? colors.text.primaryDark : colors.gray[950] }]}>
                Select State
              </Text>
              <TouchableOpacity onPress={() => setStatePickerVisible(false)}>
                <FontAwesome name="times" size={20} color={isDark ? colors.gray[400] : colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={regions}
              keyExtractor={(item) => item.value}
              style={styles.modalList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    state === item.value && { backgroundColor: isDark ? colors.gray[700] : colors.background.tertiary },
                  ]}
                  onPress={() => {
                    handleStateChange(item.value);
                    setStatePickerVisible(false);
                  }}>
                  <Text style={[styles.modalOptionText, { color: isDark ? colors.text.primaryDark : colors.gray[950] }]}>
                    {item.label}
                  </Text>
                  {state === item.value && (
                    <FontAwesome name="check" size={16} color={colors.primary.blue} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Payment Method Picker Modal */}
      <Modal visible={paymentPickerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? colors.text.primaryDark : colors.gray[950] }]}>
                Payment Method
              </Text>
              <TouchableOpacity onPress={() => setPaymentPickerVisible(false)}>
                <FontAwesome name="times" size={20} color={isDark ? colors.gray[400] : colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={paymentOptions}
              keyExtractor={(item) => item.value}
              style={styles.modalList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    paymentMethod === item.value && { backgroundColor: isDark ? colors.gray[700] : colors.background.tertiary },
                  ]}
                  onPress={() => {
                    setPaymentMethod(item.value);
                    setPaymentPickerVisible(false);
                  }}>
                  <Text style={[styles.modalOptionText, { color: isDark ? colors.text.primaryDark : colors.gray[950] }]}>
                    {item.label}
                  </Text>
                  {paymentMethod === item.value && (
                    <FontAwesome name="check" size={16} color={colors.primary.blue} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
  },
  formContent: {
    gap: 24,
    paddingBottom: 24,
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
  rowInputs: {
    flexDirection: 'row',
    gap: 16,
  },
  taxInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taxInput: {
    flex: 1,
    fontSize: 17,
    height: '100%',
  },
  taxSuffix: {
    fontSize: 17,
    marginRight: 4,
  },
  taxHint: {
    fontSize: 13,
    marginTop: -16,
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
    backgroundColor: colors.status.success,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  finishButtonDisabled: {
    backgroundColor: colors.status.successLight,
  },
  finishButtonText: {
    color: colors.text.inverse,
    fontSize: 17,
    fontWeight: '600',
  },
  dropdown: {
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownIcon: {
    marginRight: 12,
  },
  dropdownText: {
    fontSize: 17,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.special.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalList: {
    paddingBottom: 40,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingHorizontal: 20,
  },
  modalOptionText: {
    fontSize: 16,
  },
});
