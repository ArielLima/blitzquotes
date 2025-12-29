import React, { useState, useEffect } from 'react';
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
import { Stack, router, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';

const CATEGORIES = [
  { id: 'materials', label: 'Materials', icon: 'cube', color: '#3B82F6' },
  { id: 'labor', label: 'Labor', icon: 'clock-o', color: '#10B981' },
  { id: 'equipment', label: 'Equipment', icon: 'wrench', color: '#F59E0B' },
  { id: 'fees', label: 'Fees', icon: 'file-text-o', color: '#8B5CF6' },
];

const UNITS = [
  { id: 'each', label: 'Each' },
  { id: 'hour', label: 'Hour' },
  { id: 'foot', label: 'Foot' },
  { id: 'sqft', label: 'Square Foot' },
  { id: 'job', label: 'Per Job' },
  { id: 'gallon', label: 'Gallon' },
  { id: 'lb', label: 'Pound' },
];

interface PickerModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: { id: string; label: string; icon?: string; color?: string }[];
  selected: string;
  onSelect: (id: string) => void;
  isDark: boolean;
}

function PickerModal({ visible, onClose, title, options, selected, onSelect, isDark }: PickerModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <FontAwesome name="times" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalOption,
                  { backgroundColor: selected === item.id ? (isDark ? '#374151' : '#F3F4F6') : 'transparent' },
                ]}
                onPress={() => {
                  onSelect(item.id);
                  onClose();
                }}>
                {item.icon && (
                  <FontAwesome
                    name={item.icon as any}
                    size={18}
                    color={item.color || (isDark ? '#9CA3AF' : '#6B7280')}
                    style={styles.modalOptionIcon}
                  />
                )}
                <Text style={[styles.modalOptionText, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                  {item.label}
                </Text>
                {selected === item.id && (
                  <FontAwesome name="check" size={16} color="#3B82F6" style={styles.modalOptionCheck} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

export default function EditPricebookItemScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pricebook, updatePricebookItem, deletePricebookItem } = useStore();

  const item = pricebook.find(p => p.id === id);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('materials');
  const [unit, setUnit] = useState('each');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [unitPickerVisible, setUnitPickerVisible] = useState(false);

  const selectedCategory = CATEGORIES.find(c => c.id === category);
  const selectedUnit = UNITS.find(u => u.id === unit);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCategory(item.category);
      setUnit(item.unit);
      setCost(item.cost?.toString() || '');
      setPrice(item.price?.toString() || '');
    }
  }, [item]);

  if (!item) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: isDark ? '#111827' : '#F9FAFB' }]}>
        <Text style={{ color: isDark ? '#FFFFFF' : '#111827' }}>Item not found</Text>
      </View>
    );
  }

  const isValid = name.trim().length > 0 && price.length > 0;

  const markup = cost && price && parseFloat(cost) > 0
    ? ((parseFloat(price) / parseFloat(cost) - 1) * 100).toFixed(0)
    : null;

  const handleSave = async () => {
    if (!isValid) return;

    setLoading(true);
    try {
      const updates = {
        name: name.trim(),
        category,
        unit,
        cost: parseFloat(cost) || 0,
        price: parseFloat(price) || 0,
      };

      const { error } = await supabase
        .from('pricebook_items')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      updatePricebookItem(id!, updates);
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update item');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const { error } = await supabase
                .from('pricebook_items')
                .delete()
                .eq('id', id);

              if (error) throw error;

              deletePricebookItem(id!);
              router.back();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete item');
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit Item',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <FontAwesome name="arrow-left" size={18} color={isDark ? '#FFFFFF' : '#111827'} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={handleDelete} style={styles.headerButton} disabled={deleting}>
              {deleting ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <FontAwesome name="trash-o" size={20} color="#EF4444" />
              )}
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F9FAFB' }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Name */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: isDark ? '#D1D5DB' : '#374151' }]}>
              Item Name
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
              placeholder="e.g., 50 Gallon Gas Water Heater"
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Category Dropdown */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: isDark ? '#D1D5DB' : '#374151' }]}>
              Category
            </Text>
            <TouchableOpacity
              style={[
                styles.dropdown,
                {
                  backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                  borderColor: isDark ? '#374151' : '#E5E7EB',
                },
              ]}
              onPress={() => setCategoryPickerVisible(true)}>
              <View style={styles.dropdownContent}>
                {selectedCategory && (
                  <FontAwesome
                    name={selectedCategory.icon as any}
                    size={16}
                    color={selectedCategory.color}
                    style={styles.dropdownIcon}
                  />
                )}
                <Text style={[styles.dropdownText, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                  {selectedCategory?.label || 'Select category'}
                </Text>
              </View>
              <FontAwesome name="chevron-down" size={14} color={isDark ? '#6B7280' : '#9CA3AF'} />
            </TouchableOpacity>
          </View>

          {/* Unit Dropdown */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: isDark ? '#D1D5DB' : '#374151' }]}>
              Unit
            </Text>
            <TouchableOpacity
              style={[
                styles.dropdown,
                {
                  backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                  borderColor: isDark ? '#374151' : '#E5E7EB',
                },
              ]}
              onPress={() => setUnitPickerVisible(true)}>
              <Text style={[styles.dropdownText, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                {selectedUnit?.label || 'Select unit'}
              </Text>
              <FontAwesome name="chevron-down" size={14} color={isDark ? '#6B7280' : '#9CA3AF'} />
            </TouchableOpacity>
          </View>

          {/* Pricing */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: isDark ? '#D1D5DB' : '#374151' }]}>
              Pricing
            </Text>
            <View style={styles.pricingRow}>
              <View style={styles.priceField}>
                <Text style={[styles.priceLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  Your Cost
                </Text>
                <View
                  style={[
                    styles.priceInputWrapper,
                    {
                      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                      borderColor: isDark ? '#374151' : '#E5E7EB',
                    },
                  ]}>
                  <Text style={[styles.dollarSign, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>$</Text>
                  <TextInput
                    style={[styles.priceInput, { color: isDark ? '#FFFFFF' : '#111827' }]}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    value={cost}
                    onChangeText={setCost}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <View style={styles.priceField}>
                <Text style={[styles.priceLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  Customer Price
                </Text>
                <View
                  style={[
                    styles.priceInputWrapper,
                    {
                      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                      borderColor: isDark ? '#374151' : '#E5E7EB',
                    },
                  ]}>
                  <Text style={[styles.dollarSign, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>$</Text>
                  <TextInput
                    style={[styles.priceInput, { color: isDark ? '#FFFFFF' : '#111827' }]}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>
            {markup && (
              <View style={[styles.markupBadge, { backgroundColor: isDark ? '#064E3B' : '#D1FAE5' }]}>
                <FontAwesome name="arrow-up" size={10} color="#10B981" />
                <Text style={styles.markupText}>{markup}% markup</Text>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: isDark ? '#111827' : '#F9FAFB' }]}>
          <TouchableOpacity
            style={[styles.saveButton, (!isValid || loading) && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={!isValid || loading}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <FontAwesome name="check" size={16} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Pickers */}
      <PickerModal
        visible={categoryPickerVisible}
        onClose={() => setCategoryPickerVisible(false)}
        title="Select Category"
        options={CATEGORIES}
        selected={category}
        onSelect={setCategory}
        isDark={isDark}
      />
      <PickerModal
        visible={unitPickerVisible}
        onClose={() => setUnitPickerVisible(false)}
        title="Select Unit"
        options={UNITS}
        selected={unit}
        onSelect={setUnit}
        isDark={isDark}
      />
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
    padding: 20,
    paddingBottom: 120,
  },
  headerButton: {
    padding: 8,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  dropdown: {
    height: 50,
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
  },
  dropdownIcon: {
    marginRight: 10,
  },
  dropdownText: {
    fontSize: 16,
  },
  pricingRow: {
    flexDirection: 'row',
    gap: 12,
  },
  priceField: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  priceInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  dollarSign: {
    fontSize: 18,
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    height: '100%',
  },
  markupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 12,
    gap: 6,
  },
  markupText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 36,
  },
  saveButton: {
    flexDirection: 'row',
    height: 52,
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  modalOptionIcon: {
    width: 28,
  },
  modalOptionText: {
    flex: 1,
    fontSize: 16,
  },
  modalOptionCheck: {
    marginLeft: 12,
  },
});
