import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  useColorScheme,
  ScrollView,
  Alert,
  Modal,
  Share,
  ActivityIndicator,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { formatCurrency, getStatusColor, getStatusLabel } from '@/lib/utils';
import type { Quote, LineItem } from '@/types';

export default function QuoteDetailScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { id, showSaveToPricebook } = useLocalSearchParams<{ id: string; showSaveToPricebook?: string }>();
  const { quotes, settings, updateQuote, pricebook, addPricebookItem } = useStore();

  const quote = quotes.find(q => q.id === id);
  const [showPricebookModal, setShowPricebookModal] = useState(showSaveToPricebook === 'true');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [savingToPricebook, setSavingToPricebook] = useState(false);

  // Get guessed items from quote
  const guessedItems = (quote?.line_items || []).filter((item: any) => item.is_guess);

  useEffect(() => {
    // Auto-select all guessed items initially
    if (showSaveToPricebook === 'true' && guessedItems.length > 0) {
      setSelectedItems(new Set(guessedItems.map((_, i) => i)));
    }
  }, [showSaveToPricebook]);

  if (!quote) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: isDark ? '#111827' : '#F9FAFB' }]}>
        <Text style={{ color: isDark ? '#FFFFFF' : '#111827' }}>Quote not found</Text>
      </View>
    );
  }

  const handleShare = async () => {
    try {
      // In production, this would be a web URL like blitzquotes.com/q/{id}
      const message = `Quote for ${quote.customer_name}\n\nTotal: ${formatCurrency(quote.total)}\n\nView quote: https://blitzquotes.com/q/${quote.id}`;
      await Share.share({ message });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleMarkAsSent = async () => {
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', quote.id);

      if (error) throw error;
      updateQuote(quote.id, { status: 'sent', sent_at: new Date().toISOString() });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleMarkAsPaid = async () => {
    Alert.alert('Mark as Paid', 'Are you sure this quote has been paid?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, Paid',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('quotes')
              .update({ status: 'paid', paid_at: new Date().toISOString() })
              .eq('id', quote.id);

            if (error) throw error;
            updateQuote(quote.id, { status: 'paid', paid_at: new Date().toISOString() });
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const toggleItemSelection = (index: number) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleSaveToPricebook = async () => {
    if (selectedItems.size === 0) {
      setShowPricebookModal(false);
      return;
    }

    setSavingToPricebook(true);
    try {
      const itemsToSave = Array.from(selectedItems).map(index => guessedItems[index]);

      const pricebookItems = itemsToSave.map(item => ({
        user_id: quote.user_id,
        name: item.name,
        category: 'materials' as const, // Default, user can edit later
        unit: item.unit,
        cost: Math.round(item.unit_price * 0.6 * 100) / 100, // Estimate cost as 60% of price
        price: item.unit_price,
        default_qty: item.qty,
      }));

      const { data, error } = await supabase
        .from('pricebook_items')
        .insert(pricebookItems)
        .select();

      if (error) throw error;

      if (data) {
        data.forEach(item => addPricebookItem(item));
        Alert.alert('Success', `${data.length} item${data.length > 1 ? 's' : ''} saved to your pricebook`);
      }

      setShowPricebookModal(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save items');
    } finally {
      setSavingToPricebook(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Quote',
          headerRight: () => (
            <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
              <FontAwesome name="share" size={20} color="#3B82F6" />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F9FAFB' }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header Card */}
          <View style={[styles.headerCard, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
            <View style={styles.headerTop}>
              <View>
                <Text style={[styles.customerName, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                  {quote.customer_name}
                </Text>
                {quote.customer_phone && (
                  <Text style={[styles.customerPhone, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                    {quote.customer_phone}
                  </Text>
                )}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(quote.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(quote.status) }]}>
                  {getStatusLabel(quote.status)}
                </Text>
              </View>
            </View>
            <Text style={[styles.jobDescription, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              {quote.job_description}
            </Text>
          </View>

          {/* Line Items */}
          <Text style={[styles.sectionHeader, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            LINE ITEMS
          </Text>

          {quote.line_items.map((item: LineItem, index: number) => (
            <View
              key={index}
              style={[styles.lineItem, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
              <View style={styles.lineItemTop}>
                <Text style={[styles.lineItemName, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                  {item.name}
                </Text>
                <Text style={[styles.lineItemTotal, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                  {formatCurrency(item.total)}
                </Text>
              </View>
              <Text style={[styles.lineItemMeta, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                {item.qty} {item.unit} × {formatCurrency(item.unit_price)}
              </Text>
            </View>
          ))}

          {/* Totals */}
          <View style={[styles.totalsCard, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
            <View style={styles.totalsRow}>
              <Text style={[styles.totalsLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Subtotal</Text>
              <Text style={[styles.totalsValue, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                {formatCurrency(quote.subtotal)}
              </Text>
            </View>
            {quote.tax > 0 && (
              <View style={styles.totalsRow}>
                <Text style={[styles.totalsLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  Tax ({(quote.tax_rate * 100).toFixed(1)}%)
                </Text>
                <Text style={[styles.totalsValue, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                  {formatCurrency(quote.tax)}
                </Text>
              </View>
            )}
            <View style={[styles.totalsRow, styles.totalRow]}>
              <Text style={[styles.totalLabel, { color: isDark ? '#FFFFFF' : '#111827' }]}>Total</Text>
              <Text style={[styles.totalValue, { color: '#3B82F6' }]}>
                {formatCurrency(quote.total)}
              </Text>
            </View>
          </View>

          {/* Notes */}
          {quote.notes && (
            <>
              <Text style={[styles.sectionHeader, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                NOTES
              </Text>
              <View style={[styles.notesCard, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
                <Text style={[styles.notesText, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>
                  {quote.notes}
                </Text>
              </View>
            </>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View style={[styles.footer, { backgroundColor: isDark ? '#111827' : '#F9FAFB' }]}>
          {quote.status === 'draft' && (
            <TouchableOpacity style={styles.primaryButton} onPress={handleMarkAsSent}>
              <FontAwesome name="send" size={16} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Mark as Sent</Text>
            </TouchableOpacity>
          )}
          {quote.status === 'sent' && (
            <TouchableOpacity style={styles.successButton} onPress={handleMarkAsPaid}>
              <FontAwesome name="check" size={16} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Mark as Paid</Text>
            </TouchableOpacity>
          )}
          {quote.status === 'paid' && (
            <View style={styles.paidBanner}>
              <FontAwesome name="check-circle" size={20} color="#10B981" />
              <Text style={styles.paidText}>Paid</Text>
            </View>
          )}
        </View>
      </View>

      {/* Save to Pricebook Modal */}
      <Modal
        visible={showPricebookModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPricebookModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                Save to Pricebook?
              </Text>
              <TouchableOpacity onPress={() => setShowPricebookModal(false)}>
                <FontAwesome name="times" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              These items were AI-estimated. Save them to your pricebook for future quotes.
            </Text>

            <ScrollView style={styles.modalList}>
              {guessedItems.map((item: any, index: number) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.modalItem,
                    { backgroundColor: isDark ? '#374151' : '#F9FAFB' },
                    selectedItems.has(index) && styles.modalItemSelected,
                  ]}
                  onPress={() => toggleItemSelection(index)}>
                  <View style={styles.modalItemCheck}>
                    {selectedItems.has(index) ? (
                      <FontAwesome name="check-square" size={20} color="#3B82F6" />
                    ) : (
                      <FontAwesome name="square-o" size={20} color={isDark ? '#6B7280' : '#9CA3AF'} />
                    )}
                  </View>
                  <View style={styles.modalItemInfo}>
                    <Text style={[styles.modalItemName, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.modalItemPrice, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                      {formatCurrency(item.unit_price)} / {item.unit}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalSkipButton}
                onPress={() => setShowPricebookModal(false)}>
                <Text style={[styles.modalSkipText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  Skip
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveButton, savingToPricebook && styles.buttonDisabled]}
                onPress={handleSaveToPricebook}
                disabled={savingToPricebook}>
                {savingToPricebook ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>
                    Save {selectedItems.size} Item{selectedItems.size !== 1 ? 's' : ''}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  headerButton: {
    padding: 8,
  },
  headerCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  customerName: {
    fontSize: 20,
    fontWeight: '600',
  },
  customerPhone: {
    fontSize: 14,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  jobDescription: {
    fontSize: 15,
    lineHeight: 22,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  lineItem: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 6,
  },
  lineItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lineItemName: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  lineItemTotal: {
    fontSize: 15,
    fontWeight: '600',
  },
  lineItemMeta: {
    fontSize: 13,
    marginTop: 4,
  },
  totalsCard: {
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
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
    fontSize: 22,
    fontWeight: '700',
  },
  notesCard: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  notesText: {
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
  },
  primaryButton: {
    flexDirection: 'row',
    height: 52,
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  successButton: {
    flexDirection: 'row',
    height: 52,
    backgroundColor: '#10B981',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  paidBanner: {
    flexDirection: 'row',
    height: 52,
    backgroundColor: '#D1FAE5',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  paidText: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  modalList: {
    maxHeight: 300,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  modalItemSelected: {
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  modalItemCheck: {
    marginRight: 12,
  },
  modalItemInfo: {
    flex: 1,
  },
  modalItemName: {
    fontSize: 15,
    fontWeight: '500',
  },
  modalItemPrice: {
    fontSize: 13,
    marginTop: 2,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingBottom: 20,
  },
  modalSkipButton: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSkipText: {
    fontSize: 16,
    fontWeight: '500',
  },
  modalSaveButton: {
    flex: 2,
    height: 48,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
