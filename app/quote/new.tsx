import React, { useState, useCallback } from 'react';
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
  Modal,
  FlatList,
} from 'react-native';
import { Stack, router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { searchBlitzPrices, type BlitzPricesResult } from '@/lib/blitzprices';

interface QuoteLineItem {
  name: string;
  category: string;
  qty: number;
  unit: string;
  retail_price: number;      // What retail stores charge
  contractor_cost: number;   // After contractor discount
  unit_price: number;        // Customer price (after markup)
  total: number;
  needs_price: boolean;
}

export default function NewQuoteScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, settings, addQuote } = useStore();

  const [step, setStep] = useState<'describe' | 'review'>('describe');
  const [jobDescription, setJobDescription] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [laborHours, setLaborHours] = useState(0);
  const [laborTotal, setLaborTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');

  // Item editor modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BlitzPricesResult[]>([]);
  const [searching, setSearching] = useState(false);

  const taxRate = settings?.default_tax_rate || 0;
  const contractorDiscount = settings?.contractor_discount || 0;
  const materialsSubtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const materialsCost = lineItems.reduce((sum, item) => sum + (item.contractor_cost * item.qty), 0);
  const subtotal = materialsSubtotal + laborTotal;
  const tax = materialsSubtotal * taxRate; // Tax usually on materials only
  const total = subtotal + tax;
  const materialsProfit = materialsSubtotal - materialsCost;

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
            job_description: jobDescription,
            trade: settings?.trade || 'general',
            settings: {
              labor_rate: settings?.labor_rate || 100,
              helper_rate: settings?.helper_rate,
              contractor_discount: settings?.contractor_discount || 0,
              material_markup: settings?.material_markup || 0.35,
              equipment_markup: settings?.equipment_markup,
              fee_markup: settings?.fee_markup,
              default_tax_rate: settings?.default_tax_rate || 0,
              state: settings?.state,
            },
          }),
        }
      );

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      if (data.items) {
        setLineItems(data.items.line_items || []);
        setLaborHours(data.items.labor_hours || 0);
        setLaborTotal(data.items.labor_total || 0);
        if (data.items.notes) {
          setNotes(data.items.notes);
        }
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

  // Live search BlitzPrices
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const results = await searchBlitzPrices(query.trim(), settings?.state || 'US', { limit: 10 });
      setSearchResults(results.results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  }, [settings?.state]);

  // Calculate contractor cost from retail price (apply discount)
  const calculateContractorCost = (retailPrice: number) => {
    const discount = settings?.contractor_discount || 0;
    return Math.round(retailPrice * (1 - discount) * 100) / 100;
  };

  // Calculate customer price from contractor cost (apply markup)
  const calculateCustomerPrice = (contractorCost: number, category: string) => {
    let markup = settings?.material_markup || 0.35;
    if (category === 'equipment' && settings?.equipment_markup !== undefined) {
      markup = settings.equipment_markup;
    } else if (category === 'fees' && settings?.fee_markup !== undefined) {
      markup = settings.fee_markup;
    }
    return Math.round(contractorCost * (1 + markup) * 100) / 100;
  };

  // Select item from search results
  const handleSelectItem = (item: BlitzPricesResult) => {
    const retailPrice = item.avg_cost;  // BlitzPrices stores retail prices
    const contractorCost = calculateContractorCost(retailPrice);
    const unitPrice = calculateCustomerPrice(contractorCost, item.category);

    const newItem: QuoteLineItem = {
      name: item.name,
      category: item.category,
      qty: 1,
      unit: item.unit,
      retail_price: retailPrice,
      contractor_cost: contractorCost,
      unit_price: unitPrice,
      total: unitPrice,
      needs_price: false,
    };

    if (editingIndex !== null) {
      // Replace existing item
      setLineItems(items => items.map((it, i) => i === editingIndex ? newItem : it));
    } else {
      // Add new item
      setLineItems(items => [...items, newItem]);
    }

    setEditModalVisible(false);
    setEditingIndex(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Open editor for existing item or new item
  const openItemEditor = (index: number | null) => {
    setEditingIndex(index);
    if (index !== null) {
      setSearchQuery(lineItems[index].name);
    } else {
      setSearchQuery('');
    }
    setSearchResults([]);
    setEditModalVisible(true);
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    if (newQty < 1) return;
    setLineItems(items =>
      items.map((item, i) =>
        i === index
          ? { ...item, qty: newQty, total: newQty * item.unit_price }
          : item
      )
    );
  };

  const handleUpdateLaborHours = (hours: number) => {
    if (hours < 0) return;
    setLaborHours(hours);
    setLaborTotal(hours * (settings?.labor_rate || 100));
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
            <TouchableOpacity
              key={index}
              style={[styles.lineItem, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}
              onPress={() => openItemEditor(index)}
              activeOpacity={0.7}>
              <View style={styles.lineItemHeader}>
                <View style={styles.lineItemInfo}>
                  <Text style={[styles.lineItemName, { color: isDark ? '#FFFFFF' : '#111827' }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  {item.needs_price && (
                    <View style={styles.needsPriceBadge}>
                      <Text style={styles.needsPriceBadgeText}>Needs Price</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); handleRemoveItem(index); }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <FontAwesome name="trash-o" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>

              <View style={styles.lineItemDetails}>
                <View style={styles.qtyControl}>
                  <TouchableOpacity
                    style={[styles.qtyButton, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}
                    onPress={(e) => { e.stopPropagation(); handleUpdateQty(index, item.qty - 1); }}>
                    <FontAwesome name="minus" size={12} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  </TouchableOpacity>
                  <Text style={[styles.qtyText, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                    {item.qty} {item.unit}
                  </Text>
                  <TouchableOpacity
                    style={[styles.qtyButton, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}
                    onPress={(e) => { e.stopPropagation(); handleUpdateQty(index, item.qty + 1); }}>
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
            </TouchableOpacity>
          ))}

          {/* Add Item Button */}
          <TouchableOpacity
            style={[styles.addItemButton, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}
            onPress={() => openItemEditor(null)}>
            <FontAwesome name="plus" size={16} color="#3B82F6" />
            <Text style={[styles.addItemButtonText, { color: '#3B82F6' }]}>Add Item</Text>
          </TouchableOpacity>

          {/* Labor Section */}
          {laborHours > 0 && (
            <>
              <Text style={[styles.itemsHeader, { color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 16 }]}>
                LABOR
              </Text>
              <View style={[styles.lineItem, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
                <View style={styles.lineItemHeader}>
                  <Text style={[styles.lineItemName, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                    Labor
                  </Text>
                </View>
                <View style={styles.lineItemDetails}>
                  <View style={styles.qtyControl}>
                    <TouchableOpacity
                      style={[styles.qtyButton, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}
                      onPress={() => handleUpdateLaborHours(laborHours - 0.5)}>
                      <FontAwesome name="minus" size={12} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    </TouchableOpacity>
                    <Text style={[styles.qtyText, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                      {laborHours} hrs
                    </Text>
                    <TouchableOpacity
                      style={[styles.qtyButton, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}
                      onPress={() => handleUpdateLaborHours(laborHours + 0.5)}>
                      <FontAwesome name="plus" size={12} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.lineItemPricing}>
                    <Text style={[styles.unitPrice, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                      {formatCurrency(settings?.labor_rate || 100)}/hr
                    </Text>
                    <Text style={[styles.lineItemTotal, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                      {formatCurrency(laborTotal)}
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}

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

          {/* Profit Breakdown (for contractor eyes only) */}
          {lineItems.length > 0 && (
            <View style={[styles.profitCard, { backgroundColor: isDark ? '#064E3B' : '#ECFDF5' }]}>
              <View style={styles.profitHeader}>
                <FontAwesome name="eye" size={14} color={isDark ? '#34D399' : '#059669'} />
                <Text style={[styles.profitHeaderText, { color: isDark ? '#34D399' : '#059669' }]}>
                  Your Profit (not shown to customer)
                </Text>
              </View>
              <View style={styles.profitRow}>
                <Text style={[styles.profitLabel, { color: isDark ? '#A7F3D0' : '#047857' }]}>
                  Materials cost{contractorDiscount > 0 ? ` (${(contractorDiscount * 100).toFixed(0)}% off retail)` : ''}
                </Text>
                <Text style={[styles.profitValue, { color: isDark ? '#A7F3D0' : '#047857' }]}>
                  {formatCurrency(materialsCost)}
                </Text>
              </View>
              <View style={styles.profitRow}>
                <Text style={[styles.profitLabel, { color: isDark ? '#A7F3D0' : '#047857' }]}>Materials profit</Text>
                <Text style={[styles.profitValue, { color: isDark ? '#34D399' : '#059669' }]}>
                  +{formatCurrency(materialsProfit)}
                </Text>
              </View>
              <View style={styles.profitRow}>
                <Text style={[styles.profitLabel, { color: isDark ? '#A7F3D0' : '#047857' }]}>Labor</Text>
                <Text style={[styles.profitValue, { color: isDark ? '#34D399' : '#059669' }]}>
                  +{formatCurrency(laborTotal)}
                </Text>
              </View>
              <View style={[styles.profitRow, styles.profitTotalRow]}>
                <Text style={[styles.profitTotalLabel, { color: isDark ? '#FFFFFF' : '#065F46' }]}>Total Profit</Text>
                <Text style={[styles.profitTotalValue, { color: isDark ? '#34D399' : '#059669' }]}>
                  {formatCurrency(materialsProfit + laborTotal)}
                </Text>
              </View>
            </View>
          )}
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

        {/* Item Search Modal */}
        <Modal visible={editModalVisible} animationType="slide" presentationStyle="pageSheet">
          <View style={[styles.modalContainer, { backgroundColor: isDark ? '#111827' : '#F9FAFB' }]}>
            <View style={[styles.modalHeader, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
              <TouchableOpacity onPress={() => {
                setEditModalVisible(false);
                setEditingIndex(null);
                setSearchQuery('');
                setSearchResults([]);
              }}>
                <Text style={[styles.modalCancel, { color: '#3B82F6' }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                {editingIndex !== null ? 'Replace Item' : 'Add Item'}
              </Text>
              <View style={{ width: 60 }} />
            </View>

            <View style={[styles.searchContainer, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
              <FontAwesome name="search" size={16} color={isDark ? '#6B7280' : '#9CA3AF'} />
              <TextInput
                style={[styles.searchInput, { color: isDark ? '#FFFFFF' : '#111827' }]}
                placeholder="Search BlitzPrices..."
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus
              />
              {searching && <ActivityIndicator size="small" color="#3B82F6" />}
              {searchQuery.length > 0 && !searching && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                  <FontAwesome name="times-circle" size={16} color={isDark ? '#6B7280' : '#9CA3AF'} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={searchResults}
              keyExtractor={(item, index) => `${item.name}-${index}`}
              contentContainerStyle={styles.searchResultsList}
              ListEmptyComponent={
                searchQuery.length >= 2 && !searching ? (
                  <View style={styles.emptySearch}>
                    <FontAwesome name="search" size={32} color={isDark ? '#4B5563' : '#D1D5DB'} />
                    <Text style={[styles.emptySearchText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                      No items found for "{searchQuery}"
                    </Text>
                  </View>
                ) : searchQuery.length < 2 ? (
                  <View style={styles.emptySearch}>
                    <FontAwesome name="database" size={32} color={isDark ? '#4B5563' : '#D1D5DB'} />
                    <Text style={[styles.emptySearchText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                      Search BlitzPrices for materials, equipment, and fees
                    </Text>
                  </View>
                ) : null
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.searchResultItem, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}
                  onPress={() => handleSelectItem(item)}>
                  <View style={styles.searchResultInfo}>
                    <Text style={[styles.searchResultName, { color: isDark ? '#FFFFFF' : '#111827' }]} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={[styles.searchResultMeta, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
                      {item.category} · {item.unit} · {item.sample_size} reports
                    </Text>
                  </View>
                  <View style={styles.searchResultPricing}>
                    <Text style={[styles.searchResultPrice, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                      {formatCurrency(item.avg_cost)}
                    </Text>
                    <Text style={[styles.searchResultRange, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
                      {formatCurrency(item.min_cost)} - {formatCurrency(item.max_cost)}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </Modal>
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
  needsPriceBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  needsPriceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderStyle: 'dashed',
  },
  addItemButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  modalCancel: {
    fontSize: 16,
    width: 60,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  searchResultsList: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  searchResultItem: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  searchResultMeta: {
    fontSize: 13,
  },
  searchResultPricing: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  searchResultPrice: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchResultRange: {
    fontSize: 12,
    marginTop: 2,
  },
  emptySearch: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptySearchText: {
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  profitCard: {
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  profitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  profitHeaderText: {
    fontSize: 13,
    fontWeight: '600',
  },
  profitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  profitLabel: {
    fontSize: 14,
  },
  profitValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  profitTotalRow: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    marginBottom: 0,
  },
  profitTotalLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  profitTotalValue: {
    fontSize: 17,
    fontWeight: '700',
  },
});
