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
import { colors } from '@/lib/colors';

const CATEGORIES = [
  { id: 'materials', label: 'Materials', icon: 'cube', color: colors.primary.blue },
  { id: 'labor', label: 'Labor', icon: 'clock-o', color: colors.status.success },
  { id: 'equipment', label: 'Equipment', icon: 'wrench', color: colors.status.warning },
  { id: 'fees', label: 'Fees', icon: 'file-text-o', color: colors.special.purple },
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
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDark ? colors.text.primaryDark : colors.gray[950] }]}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <FontAwesome name="times" size={20} color={isDark ? colors.gray[400] : colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalOption,
                  { backgroundColor: selected === item.id ? (isDark ? colors.gray[700] : colors.background.tertiary) : 'transparent' },
                ]}
                onPress={() => {
                  onSelect(item.id);
                  onClose();
                }}>
                {item.icon && (
                  <FontAwesome
                    name={item.icon as any}
                    size={18}
                    color={item.color || (isDark ? colors.gray[400] : colors.text.secondary)}
                    style={styles.modalOptionIcon}
                  />
                )}
                <Text style={[styles.modalOptionText, { color: isDark ? colors.text.primaryDark : colors.gray[950] }]}>
                  {item.label}
                </Text>
                {selected === item.id && (
                  <FontAwesome name="check" size={16} color={colors.primary.blue} style={styles.modalOptionCheck} />
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
      <View style={[styles.container, styles.centered, { backgroundColor: isDark ? colors.background.primaryDark : colors.background.primary }]}>
        <Text style={{ color: isDark ? colors.text.primaryDark : colors.gray[950] }}>Item not found</Text>
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
              <FontAwesome name="arrow-left" size={18} color={isDark ? colors.text.primaryDark : colors.gray[950]} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={handleDelete} style={styles.headerButton} disabled={deleting}>
              {deleting ? (
                <ActivityIndicator size="small" color={colors.status.error} />
              ) : (
                <FontAwesome name="trash-o" size={20} color={colors.status.error} />
              )}
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: isDark ? colors.background.primaryDark : colors.background.primary }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Name */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: isDark ? colors.gray[300] : colors.gray[700] }]}>
              Item Name
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
              placeholder="e.g., 50 Gallon Gas Water Heater"
              placeholderTextColor={isDark ? colors.text.secondary : colors.gray[400]}
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Category Dropdown */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: isDark ? colors.gray[300] : colors.gray[700] }]}>
              Category
            </Text>
            <TouchableOpacity
              style={[
                styles.dropdown,
                {
                  backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary,
                  borderColor: isDark ? colors.gray[700] : colors.border.light,
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
                <Text style={[styles.dropdownText, { color: isDark ? colors.text.primaryDark : colors.gray[950] }]}>
                  {selectedCategory?.label || 'Select category'}
                </Text>
              </View>
              <FontAwesome name="chevron-down" size={14} color={isDark ? colors.text.secondary : colors.gray[400]} />
            </TouchableOpacity>
          </View>

          {/* Unit Dropdown */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: isDark ? colors.gray[300] : colors.gray[700] }]}>
              Unit
            </Text>
            <TouchableOpacity
              style={[
                styles.dropdown,
                {
                  backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary,
                  borderColor: isDark ? colors.gray[700] : colors.border.light,
                },
              ]}
              onPress={() => setUnitPickerVisible(true)}>
              <Text style={[styles.dropdownText, { color: isDark ? colors.text.primaryDark : colors.gray[950] }]}>
                {selectedUnit?.label || 'Select unit'}
              </Text>
              <FontAwesome name="chevron-down" size={14} color={isDark ? colors.text.secondary : colors.gray[400]} />
            </TouchableOpacity>
          </View>

          {/* Pricing */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: isDark ? colors.gray[300] : colors.gray[700] }]}>
              Pricing
            </Text>
            <View style={styles.pricingRow}>
              <View style={styles.priceField}>
                <Text style={[styles.priceLabel, { color: isDark ? colors.gray[400] : colors.text.secondary }]}>
                  Your Cost
                </Text>
                <View
                  style={[
                    styles.priceInputWrapper,
                    {
                      backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary,
                      borderColor: isDark ? colors.gray[700] : colors.border.light,
                    },
                  ]}>
                  <Text style={[styles.dollarSign, { color: isDark ? colors.text.secondary : colors.gray[400] }]}>$</Text>
                  <TextInput
                    style={[styles.priceInput, { color: isDark ? colors.text.primaryDark : colors.gray[950] }]}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? colors.text.secondary : colors.gray[400]}
                    value={cost}
                    onChangeText={setCost}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <View style={styles.priceField}>
                <Text style={[styles.priceLabel, { color: isDark ? colors.gray[400] : colors.text.secondary }]}>
                  Customer Price
                </Text>
                <View
                  style={[
                    styles.priceInputWrapper,
                    {
                      backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary,
                      borderColor: isDark ? colors.gray[700] : colors.border.light,
                    },
                  ]}>
                  <Text style={[styles.dollarSign, { color: isDark ? colors.text.secondary : colors.gray[400] }]}>$</Text>
                  <TextInput
                    style={[styles.priceInput, { color: isDark ? colors.text.primaryDark : colors.gray[950] }]}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? colors.text.secondary : colors.gray[400]}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>
            {markup && (
              <View style={[styles.markupBadge, { backgroundColor: isDark ? colors.status.successBgDark : colors.status.successBg }]}>
                <FontAwesome name="arrow-up" size={10} color={colors.status.success} />
                <Text style={styles.markupText}>{markup}% markup</Text>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: isDark ? colors.background.primaryDark : colors.background.primary }]}>
          <TouchableOpacity
            style={[styles.saveButton, (!isValid || loading) && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={!isValid || loading}>
            {loading ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <>
                <FontAwesome name="check" size={16} color={colors.text.inverse} />
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
    color: colors.status.success,
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
    backgroundColor: colors.primary.blue,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.special.overlay,
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
    borderBottomColor: colors.border.light,
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
