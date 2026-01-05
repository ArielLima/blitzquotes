import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  ActivityIndicator,
  Keyboard,
  Modal,
  useColorScheme,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors } from '@/lib/colors';

const RADAR_API_KEY = process.env.EXPO_PUBLIC_RADAR_KEY;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface RadarAddress {
  formattedAddress: string;
  addressLabel?: string;
  placeLabel?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSelectAddress?: (address: RadarAddress) => void;
  placeholder?: string;
  style?: any;
  inputStyle?: any;
}

export default function AddressAutocomplete({
  value,
  onChangeText,
  onSelectAddress,
  placeholder = 'Job site address',
  style,
  inputStyle,
}: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [suggestions, setSuggestions] = useState<RadarAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchText, setSearchText] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Sync searchText with value prop
  useEffect(() => {
    setSearchText(value);
  }, [value]);

  const searchAddresses = useCallback(async (query: string) => {
    if (!query || query.length < 3 || !RADAR_API_KEY) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://api.radar.io/v1/search/autocomplete?query=${encodeURIComponent(query)}&limit=5`,
        {
          headers: {
            Authorization: RADAR_API_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Radar API error');
      }

      const data = await response.json();
      setSuggestions(data.addresses || []);
    } catch (error) {
      console.error('Address search error:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTextChange = useCallback((text: string) => {
    setSearchText(text);

    // Debounce API calls
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchAddresses(text);
    }, 300);
  }, [searchAddresses]);

  const handleSelectSuggestion = useCallback((address: RadarAddress) => {
    const fullAddress = address.formattedAddress || address.addressLabel || '';
    setSearchText(fullAddress);
    onChangeText(fullAddress);
    onSelectAddress?.(address);
    setSuggestions([]);
    setModalVisible(false);
  }, [onChangeText, onSelectAddress]);

  const handleOpenModal = () => {
    setModalVisible(true);
    // Focus input after modal opens
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleCloseModal = () => {
    onChangeText(searchText);
    setModalVisible(false);
    setSuggestions([]);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <>
      {/* Display-only input that opens modal */}
      <TouchableOpacity
        style={[styles.container, style]}
        onPress={handleOpenModal}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.inputWrapper,
            {
              backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary,
              borderColor: isDark ? colors.border.dark : colors.border.light,
            },
            inputStyle,
          ]}
        >
          <FontAwesome
            name="map-marker"
            size={16}
            color={isDark ? colors.text.placeholderDark : colors.text.placeholder}
            style={styles.icon}
          />
          <Text
            style={[
              styles.displayText,
              { color: value ? (isDark ? colors.text.primaryDark : colors.text.primary) : (isDark ? colors.text.placeholderDark : colors.text.placeholder) },
            ]}
            numberOfLines={1}
          >
            {value || placeholder}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Modal with search input and suggestions */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView
          style={[styles.modalContainer, { backgroundColor: isDark ? colors.background.primaryDark : colors.background.primary }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={[styles.modalHeader, { backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary }]}>
            <TouchableOpacity onPress={handleCloseModal}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
              Job Site Address
            </Text>
            <TouchableOpacity onPress={handleCloseModal}>
              <Text style={styles.modalDone}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Search input */}
          <View style={[styles.searchContainer, { backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary }]}>
            <FontAwesome name="search" size={16} color={isDark ? colors.text.placeholderDark : colors.text.placeholder} />
            <TextInput
              ref={inputRef}
              style={[styles.searchInput, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}
              placeholder="Search address..."
              placeholderTextColor={isDark ? colors.text.placeholderDark : colors.text.placeholder}
              value={searchText}
              onChangeText={handleTextChange}
              autoCorrect={false}
              autoCapitalize="words"
              autoFocus
            />
            {loading && <ActivityIndicator size="small" color={colors.primary.blue} />}
            {searchText.length > 0 && !loading && (
              <TouchableOpacity
                onPress={() => {
                  setSearchText('');
                  setSuggestions([]);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <FontAwesome name="times-circle" size={16} color={isDark ? colors.text.placeholderDark : colors.text.placeholder} />
              </TouchableOpacity>
            )}
          </View>

          {/* Suggestions list */}
          <FlatList
            data={suggestions}
            keyExtractor={(item, index) => `${item.formattedAddress}-${index}`}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.suggestionsList}
            ListEmptyComponent={
              searchText.length >= 3 && !loading ? (
                <View style={styles.emptyState}>
                  <FontAwesome name="map-marker" size={32} color={isDark ? colors.gray[600] : colors.gray[300]} />
                  <Text style={[styles.emptyText, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                    No addresses found
                  </Text>
                  <Text style={[styles.emptyHint, { color: isDark ? colors.text.placeholderDark : colors.text.placeholder }]}>
                    Try a different search or tap Done to use entered text
                  </Text>
                </View>
              ) : searchText.length < 3 ? (
                <View style={styles.emptyState}>
                  <FontAwesome name="map-marker" size={32} color={isDark ? colors.gray[600] : colors.gray[300]} />
                  <Text style={[styles.emptyText, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                    Enter an address
                  </Text>
                  <Text style={[styles.emptyHint, { color: isDark ? colors.text.placeholderDark : colors.text.placeholder }]}>
                    Start typing to search for addresses
                  </Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.suggestionItem, { backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary }]}
                onPress={() => handleSelectSuggestion(item)}
              >
                <FontAwesome
                  name="map-marker"
                  size={16}
                  color={colors.primary.blue}
                  style={styles.suggestionIcon}
                />
                <View style={styles.suggestionText}>
                  <Text
                    style={[styles.suggestionPrimary, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}
                    numberOfLines={1}
                  >
                    {item.addressLabel || item.placeLabel || item.formattedAddress}
                  </Text>
                  {item.city && (
                    <Text
                      style={[styles.suggestionSecondary, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}
                      numberOfLines={1}
                    >
                      {[item.city, item.stateCode, item.postalCode].filter(Boolean).join(', ')}
                    </Text>
                  )}
                </View>
                <FontAwesome name="chevron-right" size={12} color={isDark ? colors.text.placeholderDark : colors.text.placeholder} />
              </TouchableOpacity>
            )}
          />
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {},
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  icon: {
    marginRight: 10,
  },
  displayText: {
    flex: 1,
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  modalCancel: {
    fontSize: 16,
    color: colors.text.secondary,
    width: 60,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalDone: {
    fontSize: 16,
    color: colors.primary.blue,
    fontWeight: '600',
    width: 60,
    textAlign: 'right',
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
  suggestionsList: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  suggestionIcon: {
    marginRight: 12,
    width: 16,
  },
  suggestionText: {
    flex: 1,
  },
  suggestionPrimary: {
    fontSize: 15,
    fontWeight: '500',
  },
  suggestionSecondary: {
    fontSize: 13,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptyHint: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
