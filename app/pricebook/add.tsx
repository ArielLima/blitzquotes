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
  Modal,
  FlatList,
  ActionSheetIOS,
  Image,
} from 'react-native';
import { Stack, router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { submitToBlitzPrices, getRegions, getCategories, getUnits } from '@/lib/blitzprices';

// Categories for BlitzPrices (NO LABOR - labor is in user settings)
const CATEGORIES = [
  { id: 'materials', label: 'Materials', icon: 'cube', color: '#3B82F6' },
  { id: 'equipment', label: 'Equipment', icon: 'wrench', color: '#F59E0B' },
  { id: 'fees', label: 'Fees', icon: 'file-text-o', color: '#8B5CF6' },
];

const UNITS = [
  { id: 'each', label: 'Each' },
  { id: 'foot', label: 'Foot' },
  { id: 'sqft', label: 'Square Foot' },
  { id: 'gallon', label: 'Gallon' },
  { id: 'lb', label: 'Pound' },
  { id: 'job', label: 'Per Job' },
];

interface PickerModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: { id?: string; value?: string; label: string; icon?: string; color?: string }[];
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
            keyExtractor={(item) => item.id || item.value || item.label}
            renderItem={({ item }) => {
              const itemId = item.id || item.value || '';
              return (
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    { backgroundColor: selected === itemId ? (isDark ? '#374151' : '#F3F4F6') : 'transparent' },
                  ]}
                  onPress={() => {
                    onSelect(itemId);
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
                  {selected === itemId && (
                    <FontAwesome name="check" size={16} color="#3B82F6" style={styles.modalOptionCheck} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

export default function AddPriceScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, settings } = useStore();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('materials');
  const [unit, setUnit] = useState('each');
  const [cost, setCost] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [unitPickerVisible, setUnitPickerVisible] = useState(false);

  // Use region from settings (set during onboarding, editable in settings)
  const region = settings?.state || 'TX';
  const regionLabel = getRegions().find(r => r.value === region)?.label || region;

  const selectedCategory = CATEGORIES.find(c => c.id === category);
  const selectedUnit = UNITS.find(u => u.id === unit);

  const isValid = name.trim().length > 0 && cost.length > 0 && parseFloat(cost) > 0;

  const showImageOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            takePhoto();
          } else if (buttonIndex === 2) {
            pickImage();
          }
        }
      );
    } else {
      Alert.alert(
        'Add Photo',
        'Take a photo of a price tag to auto-fill item details',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: takePhoto },
          { text: 'Choose from Library', onPress: pickImage },
        ]
      );
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      handleImageSelected(result.assets[0]);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      handleImageSelected(result.assets[0]);
    }
  };

  const handleImageSelected = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.base64) {
      Alert.alert('Error', 'Could not process image');
      return;
    }

    setImageUri(asset.uri);
    setAnalyzing(true);

    try {
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
      const { data: { session } } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          action: 'analyze_price_tag',
          image: asset.base64,
          trade: settings?.trade || 'general',
          user_token: session?.access_token,
        },
        headers: {
          Authorization: `Bearer ${anonKey}`,
        },
      });

      if (error) throw error;

      const result = data.items;

      if (result) {
        setName(result.name || '');
        // Map category - exclude labor
        if (result.category && CATEGORIES.find(c => c.id === result.category)) {
          setCategory(result.category);
        } else if (result.category === 'labor') {
          // Don't set labor - default to materials
          setCategory('materials');
        }
        if (result.unit && UNITS.find(u => u.id === result.unit)) {
          setUnit(result.unit);
        }
        if (result.price) {
          setCost(result.price.toString());
        }

        if (result.confidence === 'low') {
          Alert.alert(
            'Low Confidence',
            'The price tag was difficult to read. Please verify the extracted details.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error: any) {
      console.error('Price tag analysis error:', error);
      Alert.alert('Error', 'Could not analyze price tag. Please enter details manually.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !isValid) return;

    setLoading(true);
    try {
      const response = await submitToBlitzPrices({
        name: name.trim(),
        category: category as 'materials' | 'equipment' | 'fees',
        unit,
        cost: parseFloat(cost),
        region,
        zip_code: settings?.zip_code,
        trade: settings?.trade,
        source: imageUri ? 'price_tag_scan' : 'manual',
      });

      if (response.success) {
        Alert.alert(
          'Price Added',
          response.is_outlier
            ? 'Thanks! Your price was submitted but flagged for review since it differs significantly from the average.'
            : 'Thanks for contributing to BlitzPrices!',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit price');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Add Price',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <FontAwesome name="times" size={20} color={isDark ? '#FFFFFF' : '#111827'} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={showImageOptions} style={styles.headerButton} disabled={analyzing}>
              {analyzing ? (
                <ActivityIndicator size="small" color="#3B82F6" />
              ) : (
                <FontAwesome name="camera" size={20} color="#3B82F6" />
              )}
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F9FAFB' }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Info Banner */}
          <View style={[styles.infoBanner, { backgroundColor: isDark ? '#1E3A5F' : '#DBEAFE' }]}>
            <FontAwesome name="info-circle" size={16} color="#3B82F6" />
            <Text style={[styles.infoBannerText, { color: isDark ? '#93C5FD' : '#1E40AF' }]}>
              Add real prices you've paid to help other contractors
            </Text>
          </View>

          {/* Photo Scan Banner */}
          {!imageUri && !name && (
            <TouchableOpacity
              style={[styles.scanBanner, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}
              onPress={showImageOptions}
              disabled={analyzing}>
              <View style={styles.scanBannerIcon}>
                <FontAwesome name="camera" size={24} color="#3B82F6" />
              </View>
              <View style={styles.scanBannerText}>
                <Text style={[styles.scanBannerTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                  Snap a Price Tag
                </Text>
                <Text style={[styles.scanBannerSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  Auto-fill item details from a photo
                </Text>
              </View>
              <FontAwesome name="chevron-right" size={16} color={isDark ? '#6B7280' : '#9CA3AF'} />
            </TouchableOpacity>
          )}

          {/* Preview Image */}
          {imageUri && (
            <View style={styles.imagePreview}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => setImageUri(null)}>
                <FontAwesome name="times" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Loading State */}
          {analyzing && (
            <View style={[styles.analyzingOverlay, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={[styles.analyzingText, { color: isDark ? '#D1D5DB' : '#6B7280' }]}>
                Analyzing price tag...
              </Text>
            </View>
          )}

          {/* Region Indicator (from Settings) */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: isDark ? '#D1D5DB' : '#374151' }]}>
              Region
            </Text>
            <View
              style={[
                styles.regionIndicator,
                {
                  backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                  borderColor: isDark ? '#374151' : '#E5E7EB',
                },
              ]}>
              <FontAwesome name="map-marker" size={16} color="#3B82F6" style={styles.dropdownIcon} />
              <Text style={[styles.dropdownText, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                {regionLabel}
              </Text>
            </View>
            <Text style={[styles.helpText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
              Change region in Settings
            </Text>
          </View>

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
              autoFocus={!imageUri}
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

          {/* Cost */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: isDark ? '#D1D5DB' : '#374151' }]}>
              Cost (what you paid)
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
            <Text style={[styles.helpText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
              Enter the actual cost you paid (not the price you charge customers)
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: isDark ? '#111827' : '#F9FAFB' }]}>
          <TouchableOpacity
            style={[styles.saveButton, (!isValid || loading) && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!isValid || loading}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <FontAwesome name="cloud-upload" size={16} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Submit to BlitzPrices</Text>
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
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  headerButton: {
    padding: 8,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 10,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
  },
  scanBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    marginBottom: 24,
  },
  scanBannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  scanBannerText: {
    flex: 1,
  },
  scanBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  scanBannerSubtitle: {
    fontSize: 13,
  },
  imagePreview: {
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzingOverlay: {
    padding: 24,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  analyzingText: {
    marginTop: 12,
    fontSize: 15,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    marginTop: 6,
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
  regionIndicator: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
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
    maxHeight: '70%',
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
