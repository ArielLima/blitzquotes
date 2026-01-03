import React, { useState, useCallback, useEffect } from 'react';
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
  Image,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { searchBlitzPrices, type BlitzPricesResult } from '@/lib/blitzprices';
import type { QuoteAttachment } from '@/types';

const QUOTE_MODE_KEY = 'blitzquotes_quote_mode';

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
  const { editId, duplicateId } = useLocalSearchParams<{ editId?: string; duplicateId?: string }>();
  const { user, settings, addQuote, quotes, updateQuote } = useStore();

  const isEditing = !!editId;
  const isDuplicating = !!duplicateId;
  const sourceQuote = isEditing ? quotes.find(q => q.id === editId) : isDuplicating ? quotes.find(q => q.id === duplicateId) : null;

  // Determine document type for titles
  const getDocumentType = () => {
    if (!sourceQuote) return 'Quote';
    if (sourceQuote.type === 'invoice') return 'Invoice';
    if (sourceQuote.status === 'approved') return 'Job';
    return 'Quote';
  };
  const documentType = getDocumentType();

  const [step, setStep] = useState<'describe' | 'review'>((isEditing || isDuplicating) ? 'review' : 'describe');
  const [isManualBuild, setIsManualBuild] = useState(false);
  const [preferredMode, setPreferredMode] = useState<'ai' | 'manual' | null>(null);
  const [jobDescription, setJobDescription] = useState('');

  // Load preferred quote mode
  useEffect(() => {
    AsyncStorage.getItem(QUOTE_MODE_KEY).then((mode) => {
      if (mode === 'ai' || mode === 'manual') {
        setPreferredMode(mode);
      } else {
        setPreferredMode('ai'); // Default to AI for first-time users
      }
    });
  }, []);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [laborHours, setLaborHours] = useState(0);
  const [laborTotal, setLaborTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'analyzing' | 'searching' | 'building' | null>(null);
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<QuoteAttachment[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<{ uri: string; name: string }[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // Default valid_until to 30 days from now
  const getDefaultValidUntil = () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date;
  };
  const [validUntilDate, setValidUntilDate] = useState<Date>(getDefaultValidUntil());
  const [showValidUntilPicker, setShowValidUntilPicker] = useState(false);

  // Convert Date to YYYY-MM-DD string for database
  const toDateString = (date: Date) => date.toISOString().split('T')[0];

  // Format date for display
  const formatDateDisplay = (date: Date | string) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Load existing quote data when editing or duplicating
  useEffect(() => {
    if (sourceQuote) {
      setJobDescription(sourceQuote.job_description || '');
      setCustomerName(isDuplicating ? '' : sourceQuote.customer_name || '');
      setCustomerPhone(isDuplicating ? '' : sourceQuote.customer_phone || '');
      setCustomerEmail(isDuplicating ? '' : sourceQuote.customer_email || '');
      setLineItems(sourceQuote.line_items || []);
      setNotes(isDuplicating ? '' : sourceQuote.notes || '');
      // Load attachments (keep when duplicating so photos carry over)
      setAttachments(sourceQuote.attachments || []);
      // Load valid_until or default to 30 days
      if (sourceQuote.valid_until && !isDuplicating) {
        setValidUntilDate(new Date(sourceQuote.valid_until + 'T00:00:00'));
      }
      // Calculate labor from existing data
      const laborRate = settings?.labor_rate || 100;
      if (sourceQuote.labor_total) {
        setLaborTotal(sourceQuote.labor_total);
        setLaborHours(sourceQuote.labor_total / laborRate);
      }
    }
  }, [sourceQuote, isDuplicating]);

  // Item editor modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BlitzPricesResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Custom item form state
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState('1');
  const [customUnit, setCustomUnit] = useState('each');

  const taxRate = settings?.default_tax_rate || 0;
  const contractorDiscount = settings?.contractor_discount || 0;
  const materialsSubtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const materialsCost = lineItems.reduce((sum, item) => sum + (item.contractor_cost * item.qty), 0);
  const subtotal = materialsSubtotal + laborTotal;
  const tax = materialsSubtotal * taxRate; // Tax usually on materials only
  const total = subtotal + tax;
  const materialsProfit = materialsSubtotal - materialsCost;

  const handleStartManual = async () => {
    await AsyncStorage.setItem(QUOTE_MODE_KEY, 'manual');
    setPreferredMode('manual');
    setIsManualBuild(true);
    setStep('review');
  };

  const handleGenerateQuote = async () => {
    if (!jobDescription.trim()) {
      Alert.alert('Error', 'Please describe the job');
      return;
    }

    // Save preference
    await AsyncStorage.setItem(QUOTE_MODE_KEY, 'ai');
    setPreferredMode('ai');

    setLoading(true);
    setLoadingStep('analyzing');

    // Progress simulation - the API is a single call, so we estimate timing
    const progressTimer = setInterval(() => {
      setLoadingStep((current) => {
        if (current === 'analyzing') return 'searching';
        if (current === 'searching') return 'building';
        return current;
      });
    }, 3000);

    try {
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
      const { data: { session } } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          action: 'generate_quote',
          job_description: jobDescription,
          trade: settings?.trade || 'general',
          user_token: session?.access_token,
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
        },
        headers: {
          Authorization: `Bearer ${anonKey}`,
        },
      });

      clearInterval(progressTimer);

      if (error) throw error;

      if (data?.items) {
        setLineItems(data.items.line_items || []);
        setLaborHours(data.items.labor_hours || 0);
        setLaborTotal(data.items.labor_total || 0);
        setStep('review');
      } else {
        Alert.alert('No items', 'AI could not generate items for this job. Try a more detailed description.');
      }
    } catch (error: any) {
      clearInterval(progressTimer);
      Alert.alert('Error', error.message || 'Failed to generate quote');
    } finally {
      setLoading(false);
      setLoadingStep(null);
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

  // Add or update custom item
  const handleAddCustomItem = () => {
    const unitPrice = parseFloat(customPrice);
    if (!customName.trim() || isNaN(unitPrice) || unitPrice <= 0) {
      Alert.alert('Error', 'Please enter a valid name and price');
      return;
    }

    const qty = parseFloat(customQty) || 1;

    // When editing, preserve the original category; for new items, default to materials
    const category = editingIndex !== null ? lineItems[editingIndex].category : 'materials';

    const newItem: QuoteLineItem = {
      name: customName.trim(),
      category,
      qty,
      unit: customUnit || 'each',
      retail_price: unitPrice, // User enters the final price
      contractor_cost: unitPrice,
      unit_price: unitPrice,
      total: Math.round(unitPrice * qty * 100) / 100,
      needs_price: false,
      from_db: false,
    };

    if (editingIndex !== null) {
      setLineItems(items => items.map((it, i) => i === editingIndex ? newItem : it));
    } else {
      setLineItems(items => [...items, newItem]);
    }

    // Reset and close
    setCustomName('');
    setCustomPrice('');
    setCustomQty('1');
    setCustomUnit('each');
    setShowCustomForm(false);
    setEditModalVisible(false);
    setEditingIndex(null);
  };

  // Open editor for existing item or new item
  const openItemEditor = (index: number | null) => {
    setEditingIndex(index);
    setSearchResults([]);

    if (index !== null) {
      // Editing existing item - pre-fill form with current values
      const item = lineItems[index];
      setCustomName(item.name);
      setCustomPrice(item.unit_price.toString());
      setCustomQty(item.qty.toString());
      setCustomUnit(item.unit);
      setShowCustomForm(true); // Go straight to edit form
      setSearchQuery('');
    } else {
      // Adding new item - start with search
      setCustomName('');
      setCustomPrice('');
      setCustomQty('1');
      setCustomUnit('each');
      setShowCustomForm(false);
      setSearchQuery('');
    }

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

  const openLaborEditor = () => {
    Alert.prompt(
      'Edit Labor Hours',
      `Enter hours (current rate: ${formatCurrency(settings?.labor_rate || 100)}/hr)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: (value) => {
            const hours = parseFloat(value || '0');
            if (!isNaN(hours) && hours >= 0) {
              handleUpdateLaborHours(hours);
            }
          },
        },
      ],
      'plain-text',
      laborHours.toString(),
      'decimal-pad'
    );
  };

  const handleRemoveItem = (index: number) => {
    const itemName = lineItems[index]?.name || 'this item';
    Alert.alert(
      'Remove Item',
      `Are you sure you want to remove "${itemName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => setLineItems(items => items.filter((_, i) => i !== index)),
        },
      ]
    );
  };

  // Photo attachment functions
  const handleAddPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10,
      });

      if (result.canceled || !result.assets?.length) return;

      const newPhotos = result.assets.map((asset, index) => ({
        uri: asset.uri,
        name: asset.fileName || `photo_${Date.now()}_${index}.jpg`,
      }));

      setPendingPhotos(prev => [...prev, ...newPhotos]);
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to select photos');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow camera access to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setPendingPhotos(prev => [...prev, {
        uri: asset.uri,
        name: asset.fileName || `photo_${Date.now()}.jpg`,
      }]);
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handleRemovePendingPhoto = (index: number) => {
    setPendingPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const uploadPendingPhotos = async (quoteId: string): Promise<QuoteAttachment[]> => {
    const uploaded: QuoteAttachment[] = [];

    for (const photo of pendingPhotos) {
      try {
        const fileExt = photo.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${user?.id}/${quoteId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

        // Fetch and convert to ArrayBuffer
        const response = await fetch(photo.uri);
        const blob = await response.blob();
        const arrayBuffer = await new Response(blob).arrayBuffer();

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('quote-attachments')
          .upload(fileName, arrayBuffer, {
            contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('quote-attachments')
          .getPublicUrl(fileName);

        uploaded.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
          url: publicUrl,
          name: photo.name,
          size: blob.size,
          type: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          uploaded_at: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error uploading photo:', error);
      }
    }

    return uploaded;
  };

  const handleSaveQuote = async () => {
    if (!customerName.trim()) {
      Alert.alert('Error', 'Please enter customer name');
      return;
    }

    if (!customerPhone.trim()) {
      Alert.alert('Error', 'Please enter customer phone number');
      return;
    }

    if (lineItems.length === 0) {
      Alert.alert('Error', 'Quote must have at least one item');
      return;
    }

    setLoading(true);
    try {
      // For new quotes, we need to create first, then upload photos
      // For edits, we can upload photos using existing ID
      const quoteId = isEditing ? editId : undefined;

      // Upload pending photos if any
      let allAttachments = [...attachments];
      if (pendingPhotos.length > 0) {
        setUploadingPhotos(true);
        // For new quotes, we'll use a temp ID and update after creation
        const tempId = quoteId || `temp_${Date.now()}`;
        const uploaded = await uploadPendingPhotos(tempId);
        allAttachments = [...allAttachments, ...uploaded];
        setUploadingPhotos(false);
      }

      const quoteData = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim() || null,
        job_description: jobDescription,
        line_items: lineItems,
        labor_hours: laborHours,
        labor_rate: settings?.labor_rate || 100,
        labor_total: laborTotal,
        subtotal,
        tax_rate: taxRate,
        tax,
        total,
        notes: notes.trim() || null,
        valid_until: toDateString(validUntilDate),
        attachments: allAttachments,
      };

      if (isEditing && editId) {
        // Update existing quote
        const { data, error } = await supabase
          .from('quotes')
          .update(quoteData)
          .eq('id', editId)
          .select()
          .single();

        if (error) throw error;

        if (data) {
          updateQuote(editId, data);
          router.replace({
            pathname: '/quote/[id]',
            params: { id: editId }
          });
        }
      } else {
        // Create new quote
        const { data, error } = await supabase
          .from('quotes')
          .insert({ ...quoteData, user_id: user?.id, status: 'draft' })
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
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save quote');
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = async (mode: 'ai' | 'manual') => {
    await AsyncStorage.setItem(QUOTE_MODE_KEY, mode);
    setPreferredMode(mode);
  };

  const handleContinue = () => {
    if (preferredMode === 'manual') {
      handleStartManual();
    } else {
      handleGenerateQuote();
    }
  };

  if (step === 'describe') {
    return (
      <>
        <Stack.Screen
          options={{
            title: isEditing ? `Edit ${documentType}` : isDuplicating ? `Duplicate ${documentType}` : 'New Quote',
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
            {/* Mode Toggle */}
            <View style={[styles.modeToggle, { backgroundColor: isDark ? '#1F2937' : '#E5E7EB' }]}>
              <TouchableOpacity
                style={[
                  styles.modeToggleOption,
                  preferredMode === 'ai' && styles.modeToggleOptionActive,
                ]}
                onPress={() => handleModeChange('ai')}>
                <FontAwesome
                  name="magic"
                  size={14}
                  color={preferredMode === 'ai' ? '#FFFFFF' : (isDark ? '#9CA3AF' : '#6B7280')}
                />
                <Text style={[
                  styles.modeToggleText,
                  { color: preferredMode === 'ai' ? '#FFFFFF' : (isDark ? '#9CA3AF' : '#6B7280') },
                ]}>
                  AI Assist
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeToggleOption,
                  preferredMode === 'manual' && styles.modeToggleOptionActiveGreen,
                ]}
                onPress={() => handleModeChange('manual')}>
                <FontAwesome
                  name="list"
                  size={14}
                  color={preferredMode === 'manual' ? '#FFFFFF' : (isDark ? '#9CA3AF' : '#6B7280')}
                />
                <Text style={[
                  styles.modeToggleText,
                  { color: preferredMode === 'manual' ? '#FFFFFF' : (isDark ? '#9CA3AF' : '#6B7280') },
                ]}>
                  Manual
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                {preferredMode === 'ai' ? 'Describe the job' : 'Job description'}
              </Text>
              {preferredMode === 'ai' && (
                <Text style={[styles.sectionHint, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  Be specific — AI will suggest materials and pricing
                </Text>
              )}
              <TextInput
                style={[
                  styles.textArea,
                  {
                    backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                    color: isDark ? '#FFFFFF' : '#111827',
                    borderColor: isDark ? '#374151' : '#E5E7EB',
                  },
                ]}
                placeholder={preferredMode === 'ai'
                  ? "e.g., Replace 50 gallon gas water heater in garage. Old unit needs disposal."
                  : "Brief description (optional)"}
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                value={jobDescription}
                onChangeText={setJobDescription}
                multiline
                numberOfLines={preferredMode === 'ai' ? 5 : 3}
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
                placeholder="Customer name *"
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
                placeholder="Phone *"
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                value={customerPhone}
                onChangeText={setCustomerPhone}
                keyboardType="phone-pad"
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
                placeholder="Email (optional)"
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                value={customerEmail}
                onChangeText={setCustomerEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                Quote valid until
              </Text>
              <TouchableOpacity
                style={[styles.dateField, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF', borderColor: isDark ? '#374151' : '#E5E7EB' }]}
                onPress={() => setShowValidUntilPicker(true)}>
                <FontAwesome name="calendar" size={16} color={isDark ? '#6B7280' : '#9CA3AF'} />
                <Text style={[styles.dateText, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                  {formatDateDisplay(validUntilDate)}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={[styles.footer, { backgroundColor: isDark ? '#111827' : '#F9FAFB' }]}>
            <TouchableOpacity
              style={[
                preferredMode === 'manual' ? styles.primaryButtonGreen : styles.primaryButton,
                loading && styles.buttonDisabled,
                (preferredMode === 'ai' && !jobDescription.trim()) && styles.buttonDisabled,
              ]}
              onPress={handleContinue}
              disabled={loading || (preferredMode === 'ai' && !jobDescription.trim())}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.loadingText}>
                    {loadingStep === 'analyzing' && 'Analyzing job requirements...'}
                    {loadingStep === 'searching' && 'Searching prices...'}
                    {loadingStep === 'building' && 'Building your quote...'}
                  </Text>
                </View>
              ) : (
                <>
                  <FontAwesome
                    name={preferredMode === 'manual' ? 'arrow-right' : 'magic'}
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.primaryButtonText}>
                    {preferredMode === 'manual' ? 'Continue' : 'Generate Quote'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Valid Until Date Picker Modal */}
          <Modal
            visible={showValidUntilPicker}
            animationType="fade"
            transparent={true}
            onRequestClose={() => setShowValidUntilPicker(false)}>
            <View style={styles.dateModalOverlay}>
              <View style={[styles.dateModalContent, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
                <View style={styles.dateModalHeader}>
                  <Text style={[styles.dateModalTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                    Quote Valid Until
                  </Text>
                  <TouchableOpacity onPress={() => setShowValidUntilPicker(false)}>
                    <FontAwesome name="times" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  </TouchableOpacity>
                </View>

                <View style={styles.datePickerWrapper}>
                  {Platform.OS === 'ios' ? (
                    <DateTimePicker
                      value={validUntilDate}
                      mode="date"
                      display="spinner"
                      onChange={(event, date) => {
                        if (date) setValidUntilDate(date);
                      }}
                      style={styles.datePicker}
                    />
                  ) : (
                    <DateTimePicker
                      value={validUntilDate}
                      mode="date"
                      display="default"
                      onChange={(event, date) => {
                        if (date) setValidUntilDate(date);
                      }}
                    />
                  )}
                </View>

                <TouchableOpacity
                  style={styles.dateModalButton}
                  onPress={() => setShowValidUntilPicker(false)}>
                  <Text style={styles.dateModalButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </KeyboardAvoidingView>
      </>
    );
  }

  // Review step
  return (
    <>
      <Stack.Screen
        options={{
          title: isEditing ? `Edit ${documentType}` : isDuplicating ? `Duplicate ${documentType}` : (isManualBuild ? 'Build Quote' : 'Review Quote'),
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => (isEditing || isDuplicating) ? router.back() : setStep('describe')}
              style={styles.headerButton}>
              <FontAwesome name={(isEditing || isDuplicating) ? "times" : "arrow-left"} size={18} color={isDark ? '#FFFFFF' : '#111827'} />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F9FAFB' }]}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Customer Info Section */}
          <View style={[styles.customerSection, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
            <TextInput
              style={[styles.customerNameInput, { color: isDark ? '#FFFFFF' : '#111827' }]}
              placeholder="Customer Name *"
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              value={customerName}
              onChangeText={setCustomerName}
            />
            <TextInput
              style={[styles.customerPhoneInput, { color: isDark ? '#FFFFFF' : '#111827', borderTopColor: isDark ? '#374151' : '#E5E7EB' }]}
              placeholder="Phone *"
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              value={customerPhone}
              onChangeText={setCustomerPhone}
              keyboardType="phone-pad"
            />
            <TextInput
              style={[styles.customerPhoneInput, { color: isDark ? '#FFFFFF' : '#111827', borderTopColor: isDark ? '#374151' : '#E5E7EB' }]}
              placeholder="Email (optional)"
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              value={customerEmail}
              onChangeText={setCustomerEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.jobDescriptionInput, { color: isDark ? '#FFFFFF' : '#111827', borderTopColor: isDark ? '#374151' : '#E5E7EB' }]}
              placeholder="Job description"
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              value={jobDescription}
              onChangeText={setJobDescription}
              multiline
              numberOfLines={2}
            />
          </View>

          <View style={styles.itemsHeaderRow}>
            <Text style={[styles.itemsHeader, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              LINE ITEMS
            </Text>
            <Text style={[styles.itemsHeaderHint, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
              Tap to edit
            </Text>
          </View>

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
                <View style={styles.lineItemActions}>
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation(); handleRemoveItem(index); }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <FontAwesome name="trash-o" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
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
          <Text style={[styles.itemsHeader, { color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 16 }]}>
            LABOR
          </Text>
          {laborHours > 0 ? (
            <View style={[styles.lineItem, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
              <View style={styles.lineItemHeader}>
                <Text style={[styles.lineItemName, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                  Labor
                </Text>
                <TouchableOpacity
                  onPress={() => handleUpdateLaborHours(0)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <FontAwesome name="trash-o" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
              <View style={styles.lineItemDetails}>
                <View style={styles.qtyControl}>
                  <TouchableOpacity
                    style={[styles.qtyButton, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}
                    onPress={() => handleUpdateLaborHours(laborHours - 0.5)}>
                    <FontAwesome name="minus" size={12} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={openLaborEditor}>
                    <Text style={[styles.qtyText, { color: '#3B82F6', textDecorationLine: 'underline' }]}>
                      {laborHours} hrs
                    </Text>
                  </TouchableOpacity>
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
          ) : (
            <TouchableOpacity
              style={[styles.addItemButton, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}
              onPress={() => handleUpdateLaborHours(1)}>
              <FontAwesome name="clock-o" size={16} color="#3B82F6" />
              <Text style={[styles.addItemButtonText, { color: '#3B82F6' }]}>Add Labor</Text>
            </TouchableOpacity>
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

          {/* Photo Attachments */}
          <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                Photos
              </Text>
              <Text style={[styles.sectionSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                {attachments.length + pendingPhotos.length} attached
              </Text>
            </View>

            {/* Existing and pending photos grid */}
            {(attachments.length > 0 || pendingPhotos.length > 0) && (
              <View style={styles.photosGrid}>
                {attachments.map((attachment) => (
                  <View key={attachment.id} style={styles.photoContainer}>
                    <Image source={{ uri: attachment.url }} style={styles.photoThumbnail} />
                    <TouchableOpacity
                      style={styles.photoRemoveButton}
                      onPress={() => handleRemoveAttachment(attachment.id)}>
                      <FontAwesome name="times-circle" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                {pendingPhotos.map((photo, index) => (
                  <View key={`pending-${index}`} style={styles.photoContainer}>
                    <Image source={{ uri: photo.uri }} style={styles.photoThumbnail} />
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>New</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.photoRemoveButton}
                      onPress={() => handleRemovePendingPhoto(index)}>
                      <FontAwesome name="times-circle" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Add photo buttons */}
            <View style={styles.photoButtons}>
              <TouchableOpacity
                style={[styles.photoButton, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}
                onPress={handleTakePhoto}>
                <FontAwesome name="camera" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
                <Text style={[styles.photoButtonText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  Take Photo
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoButton, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}
                onPress={handleAddPhoto}>
                <FontAwesome name="image" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
                <Text style={[styles.photoButtonText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  From Gallery
                </Text>
              </TouchableOpacity>
            </View>
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
        <Modal visible={editModalVisible} animationType="fade" presentationStyle="pageSheet">
          <View style={[styles.modalContainer, { backgroundColor: isDark ? '#111827' : '#F9FAFB' }]}>
            <View style={[styles.modalHeader, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
              <TouchableOpacity onPress={() => {
                setEditModalVisible(false);
                setEditingIndex(null);
                setSearchQuery('');
                setSearchResults([]);
                setShowCustomForm(false);
              }}>
                <Text style={[styles.modalCancel, { color: '#3B82F6' }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                {editingIndex !== null ? 'Edit Item' : 'Add Item'}
              </Text>
              <View style={{ width: 60 }} />
            </View>

            {/* Toggle between search and custom */}
            <View style={styles.modalTabs}>
              <TouchableOpacity
                style={[styles.modalTab, !showCustomForm && styles.modalTabActive]}
                onPress={() => setShowCustomForm(false)}>
                <Text style={[styles.modalTabText, !showCustomForm && styles.modalTabTextActive]}>
                  Search
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalTab, showCustomForm && styles.modalTabActive]}
                onPress={() => setShowCustomForm(true)}>
                <Text style={[styles.modalTabText, showCustomForm && styles.modalTabTextActive]}>
                  Custom Item
                </Text>
              </TouchableOpacity>
            </View>

            {showCustomForm ? (
              <ScrollView style={styles.customFormContainer} keyboardShouldPersistTaps="handled">
                <View style={styles.customFormField}>
                  <Text style={[styles.customFormLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                    Item Name
                  </Text>
                  <TextInput
                    style={[styles.customFormInput, {
                      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                      color: isDark ? '#FFFFFF' : '#111827',
                      borderColor: isDark ? '#374151' : '#E5E7EB',
                    }]}
                    placeholder="e.g., Water heater installation"
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    value={customName}
                    onChangeText={setCustomName}
                    autoFocus
                  />
                </View>

                <View style={styles.customFormRow}>
                  <View style={[styles.customFormField, { flex: 1 }]}>
                    <Text style={[styles.customFormLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                      Price
                    </Text>
                    <TextInput
                      style={[styles.customFormInput, {
                        backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                        color: isDark ? '#FFFFFF' : '#111827',
                        borderColor: isDark ? '#374151' : '#E5E7EB',
                      }]}
                      placeholder="0.00"
                      placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                      value={customPrice}
                      onChangeText={setCustomPrice}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={[styles.customFormField, { flex: 1 }]}>
                    <Text style={[styles.customFormLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                      Qty
                    </Text>
                    <TextInput
                      style={[styles.customFormInput, {
                        backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                        color: isDark ? '#FFFFFF' : '#111827',
                        borderColor: isDark ? '#374151' : '#E5E7EB',
                      }]}
                      placeholder="1"
                      placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                      value={customQty}
                      onChangeText={setCustomQty}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={[styles.customFormField, { flex: 1 }]}>
                    <Text style={[styles.customFormLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                      Unit
                    </Text>
                    <TextInput
                      style={[styles.customFormInput, {
                        backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                        color: isDark ? '#FFFFFF' : '#111827',
                        borderColor: isDark ? '#374151' : '#E5E7EB',
                      }]}
                      placeholder="each"
                      placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                      value={customUnit}
                      onChangeText={setCustomUnit}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.customFormButton}
                  onPress={handleAddCustomItem}>
                  <Text style={styles.customFormButtonText}>
                    {editingIndex !== null ? 'Save Changes' : 'Add Item'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <>
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
                        <TouchableOpacity
                          style={styles.emptySearchAction}
                          onPress={() => {
                            setCustomName(searchQuery);
                            setShowCustomForm(true);
                          }}>
                          <Text style={styles.emptySearchActionText}>
                            Add "{searchQuery}" as custom item
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : searchQuery.length < 2 ? (
                      <View style={styles.emptySearch}>
                        <FontAwesome name="database" size={32} color={isDark ? '#4B5563' : '#D1D5DB'} />
                        <Text style={[styles.emptySearchText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                          Search BlitzPrices or add a custom item
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
              </>
            )}
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
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  dateText: {
    fontSize: 16,
  },
  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  dateModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  dateModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateModalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  datePickerWrapper: {
    alignItems: 'center',
    marginBottom: 20,
  },
  datePicker: {
    width: '100%',
    height: 200,
  },
  dateModalButton: {
    height: 52,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateModalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  primaryButton: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  primaryButtonGreen: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: '#10B981',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  modeToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  modeToggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  modeToggleOptionActive: {
    backgroundColor: '#3B82F6',
  },
  modeToggleOptionActiveGreen: {
    backgroundColor: '#10B981',
  },
  modeToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  customerSection: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  customerNameInput: {
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  customerPhoneInput: {
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  jobDescriptionInput: {
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    minHeight: 50,
  },
  itemsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginLeft: 4,
    marginRight: 4,
  },
  itemsHeader: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  itemsHeaderHint: {
    fontSize: 12,
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
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  lineItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
  emptySearchAction: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },
  emptySearchActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  modalTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  modalTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  modalTabActive: {
    backgroundColor: '#3B82F6',
  },
  modalTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  modalTabTextActive: {
    color: '#FFFFFF',
  },
  customFormContainer: {
    padding: 16,
  },
  customFormField: {
    marginBottom: 16,
  },
  customFormLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
  customFormInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  customFormRow: {
    flexDirection: 'row',
    gap: 12,
  },
  customFormButton: {
    height: 52,
    backgroundColor: '#10B981',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  customFormButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  sectionCard: {
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 13,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  photoContainer: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  photoRemoveButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  pendingBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
