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
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';

interface AILineItem {
  pricebook_item_id: string | null;
  name: string;
  qty: number;
  unit: string;
  unit_price: number;
  total: number;
  is_guess: boolean;
}

export default function NewQuoteScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, settings, pricebook, addQuote } = useStore();

  const [step, setStep] = useState<'describe' | 'review'>('describe');
  const [jobDescription, setJobDescription] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [lineItems, setLineItems] = useState<AILineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');

  const taxRate = settings?.default_tax_rate || 0;
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  const handleGenerateQuote = async () => {
    if (!jobDescription.trim()) {
      Alert.alert('Error', 'Please describe the job');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            action: 'generate_quote',
            pricebook: pricebook,
            job_description: jobDescription,
            trade: settings?.trade || 'general',
            zip_code: settings?.zip_code,
          }),
        }
      );

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      if (data.items && data.items.length > 0) {
        setLineItems(data.items);
        setStep('review');
      } else {
        Alert.alert('No items', 'AI could not generate items for this job. Try a more detailed description.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to generate quote');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    if (newQty < 0) return;
    setLineItems(items =>
      items.map((item, i) =>
        i === index
          ? { ...item, qty: newQty, total: newQty * item.unit_price }
          : item
      )
    );
  };

  const handleRemoveItem = (index: number) => {
    setLineItems(items => items.filter((_, i) => i !== index));
  };

  const handleSaveQuote = async () => {
    if (!customerName.trim()) {
      Alert.alert('Error', 'Please enter customer name');
      return;
    }

    if (lineItems.length === 0) {
      Alert.alert('Error', 'Quote must have at least one item');
      return;
    }

    setLoading(true);
    try {
      const quoteData = {
        user_id: user?.id,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        job_description: jobDescription,
        line_items: lineItems,
        subtotal,
        tax_rate: taxRate,
        tax,
        total,
        notes: notes.trim() || null,
        status: 'draft',
      };

      const { data, error } = await supabase
        .from('quotes')
        .insert(quoteData)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        addQuote(data);

        // Check if there are any guessed items to save to pricebook
        const guessedItems = lineItems.filter(item => item.is_guess);
        if (guessedItems.length > 0) {
          router.replace({
            pathname: '/quote/[id]',
            params: { id: data.id, showSaveToPricebook: 'true' }
          });
        } else {
          router.replace({
            pathname: '/quote/[id]',
            params: { id: data.id }
          });
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save quote');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'describe') {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'New Quote',
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                <FontAwesome name="times" size={20} color={isDark ? '#FFFFFF' : '#111827'} />
              </TouchableOpacity>
            ),
          }}
        />
        <KeyboardAvoidingView
          style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F9FAFB' }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                Describe the job
              </Text>
              <Text style={[styles.sectionHint, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                Be specific — include equipment, quantities, and location details
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                    color: isDark ? '#FFFFFF' : '#111827',
                    borderColor: isDark ? '#374151' : '#E5E7EB',
                  },
                ]}
                placeholder="e.g., Replace 50 gallon gas water heater in garage. Old unit needs disposal. Customer wants expansion tank installed."
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                value={jobDescription}
                onChangeText={setJobDescription}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                Customer info
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
                placeholder="Customer name"
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                value={customerName}
                onChangeText={setCustomerName}
              />
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                    color: isDark ? '#FFFFFF' : '#111827',
                    borderColor: isDark ? '#374151' : '#E5E7EB',
                  },
                ]}
                placeholder="Phone (optional)"
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                value={customerPhone}
                onChangeText={setCustomerPhone}
                keyboardType="phone-pad"
              />
            </View>
          </ScrollView>

          <View style={[styles.footer, { backgroundColor: isDark ? '#111827' : '#F9FAFB' }]}>
            <TouchableOpacity
              style={[styles.generateButton, loading && styles.buttonDisabled]}
              onPress={handleGenerateQuote}
              disabled={loading || !jobDescription.trim()}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <FontAwesome name="magic" size={18} color="#FFFFFF" />
                  <Text style={styles.generateButtonText}>Generate Quote</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </>
    );
  }

  // Review step
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Review Quote',
          headerLeft: () => (
            <TouchableOpacity onPress={() => setStep('describe')} style={styles.headerButton}>
              <FontAwesome name="arrow-left" size={18} color={isDark ? '#FFFFFF' : '#111827'} />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F9FAFB' }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.customerCard, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
            <Text style={[styles.customerName, { color: isDark ? '#FFFFFF' : '#111827' }]}>
              {customerName || 'Customer'}
            </Text>
            <Text style={[styles.jobDescription, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={2}>
              {jobDescription}
            </Text>
          </View>

          <Text style={[styles.itemsHeader, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            LINE ITEMS
          </Text>

          {lineItems.map((item, index) => (
            <View
              key={index}
              style={[styles.lineItem, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
              <View style={styles.lineItemHeader}>
                <View style={styles.lineItemInfo}>
                  <Text style={[styles.lineItemName, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                    {item.name}
                  </Text>
                  {item.is_guess && (
                    <View style={styles.guessBadge}>
                      <Text style={styles.guessBadgeText}>AI Estimate</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => handleRemoveItem(index)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <FontAwesome name="trash-o" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>

              <View style={styles.lineItemDetails}>
                <View style={styles.qtyControl}>
                  <TouchableOpacity
                    style={[styles.qtyButton, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}
                    onPress={() => handleUpdateQty(index, item.qty - 1)}>
                    <FontAwesome name="minus" size={12} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  </TouchableOpacity>
                  <Text style={[styles.qtyText, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                    {item.qty} {item.unit}
                  </Text>
                  <TouchableOpacity
                    style={[styles.qtyButton, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}
                    onPress={() => handleUpdateQty(index, item.qty + 1)}>
                    <FontAwesome name="plus" size={12} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  </TouchableOpacity>
                </View>
                <View style={styles.lineItemPricing}>
                  <Text style={[styles.unitPrice, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                    {formatCurrency(item.unit_price)}/{item.unit}
                  </Text>
                  <Text style={[styles.lineItemTotal, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                    {formatCurrency(item.total)}
                  </Text>
                </View>
              </View>
            </View>
          ))}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
              Notes (optional)
            </Text>
            <TextInput
              style={[
                styles.textArea,
                styles.notesInput,
                {
                  backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                  color: isDark ? '#FFFFFF' : '#111827',
                  borderColor: isDark ? '#374151' : '#E5E7EB',
                },
              ]}
              placeholder="Add any notes for the customer..."
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={[styles.totalsCard, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
            <View style={styles.totalsRow}>
              <Text style={[styles.totalsLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Subtotal</Text>
              <Text style={[styles.totalsValue, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                {formatCurrency(subtotal)}
              </Text>
            </View>
            {taxRate > 0 && (
              <View style={styles.totalsRow}>
                <Text style={[styles.totalsLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  Tax ({(taxRate * 100).toFixed(1)}%)
                </Text>
                <Text style={[styles.totalsValue, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                  {formatCurrency(tax)}
                </Text>
              </View>
            )}
            <View style={[styles.totalsRow, styles.totalRow]}>
              <Text style={[styles.totalLabel, { color: isDark ? '#FFFFFF' : '#111827' }]}>Total</Text>
              <Text style={[styles.totalValue, { color: '#3B82F6' }]}>
                {formatCurrency(total)}
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: isDark ? '#111827' : '#F9FAFB' }]}>
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.buttonDisabled]}
            onPress={handleSaveQuote}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.saveButtonText}>Save Quote</Text>
                <FontAwesome name="check" size={16} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  headerButton: {
    padding: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 14,
    marginBottom: 12,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 140,
  },
  notesInput: {
    minHeight: 80,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
  },
  generateButton: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  customerCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '600',
  },
  jobDescription: {
    fontSize: 14,
    marginTop: 4,
  },
  itemsHeader: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  lineItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  lineItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  lineItemInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  lineItemName: {
    fontSize: 16,
    fontWeight: '500',
  },
  guessBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  guessBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
  },
  lineItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 15,
    fontWeight: '500',
    minWidth: 60,
    textAlign: 'center',
  },
  lineItemPricing: {
    alignItems: 'flex-end',
  },
  unitPrice: {
    fontSize: 13,
  },
  lineItemTotal: {
    fontSize: 17,
    fontWeight: '600',
  },
  totalsCard: {
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalsLabel: {
    fontSize: 15,
  },
  totalsValue: {
    fontSize: 15,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  saveButton: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: '#10B981',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
