import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  useColorScheme,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { searchBlitzPrices, getRegions, getCategories, type BlitzPricesResult } from '@/lib/blitzprices';

const CATEGORY_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  materials: { label: 'Materials', icon: 'cube', color: '#3B82F6' },
  equipment: { label: 'Equipment', icon: 'wrench', color: '#F59E0B' },
  fees: { label: 'Fees', icon: 'file-text-o', color: '#8B5CF6' },
};

const CONFIDENCE_COLORS = {
  high: '#10B981',
  medium: '#F59E0B',
  low: '#EF4444',
};

function PriceCard({ item }: { item: BlitzPricesResult }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const categoryConfig = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.materials;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' },
      ]}>
      <View style={styles.cardHeader}>
        <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.color + '20' }]}>
          <FontAwesome name={categoryConfig.icon as any} size={12} color={categoryConfig.color} />
          <Text style={[styles.categoryText, { color: categoryConfig.color }]}>
            {categoryConfig.label}
          </Text>
        </View>
        <View style={styles.confidenceContainer}>
          <View style={[styles.confidenceDot, { backgroundColor: CONFIDENCE_COLORS[item.confidence] }]} />
          <Text style={[styles.confidenceText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
            {item.confidence}
          </Text>
        </View>
      </View>

      <Text style={[styles.itemName, { color: isDark ? '#FFFFFF' : '#111827' }]} numberOfLines={2}>
        {item.name}
      </Text>

      <View style={styles.cardFooter}>
        <View style={styles.priceContainer}>
          <Text style={[styles.price, { color: isDark ? '#FFFFFF' : '#111827' }]}>
            {formatCurrency(item.avg_cost)}
          </Text>
          <Text style={[styles.unit, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
            /{item.unit}
          </Text>
        </View>

        <View style={styles.rangeContainer}>
          <Text style={[styles.rangeText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
            {formatCurrency(item.min_cost)} - {formatCurrency(item.max_cost)}
          </Text>
          <Text style={[styles.sampleText, { color: isDark ? '#4B5563' : '#9CA3AF' }]}>
            {item.sample_size} reports
          </Text>
        </View>
      </View>
    </View>
  );
}

function EmptyState({ hasSearched }: { hasSearched: boolean }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (hasSearched) {
    return (
      <View style={styles.emptyState}>
        <FontAwesome name="search" size={32} color={isDark ? '#4B5563' : '#9CA3AF'} />
        <Text style={[styles.emptyTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
          No prices found
        </Text>
        <Text style={[styles.emptySubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
          Be the first to add this item to BlitzPrices
        </Text>
        <Link href="/pricebook/add" asChild>
          <TouchableOpacity style={styles.emptyAddButton}>
            <FontAwesome name="plus" size={14} color="#FFFFFF" />
            <Text style={styles.emptyAddButtonText}>Add Price</Text>
          </TouchableOpacity>
        </Link>
      </View>
    );
  }

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconContainer, { backgroundColor: isDark ? '#1E3A5F' : '#DBEAFE' }]}>
        <FontAwesome name="database" size={32} color="#3B82F6" />
      </View>
      <Text style={[styles.emptyTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
        BlitzPrices
      </Text>
      <Text style={[styles.emptySubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
        Search real prices from contractors in your area. Community-powered pricing data.
      </Text>
      <View style={styles.emptyFeatures}>
        <View style={styles.emptyFeature}>
          <FontAwesome name="check-circle" size={16} color="#10B981" />
          <Text style={[styles.featureText, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>
            Real contractor costs
          </Text>
        </View>
        <View style={styles.emptyFeature}>
          <FontAwesome name="check-circle" size={16} color="#10B981" />
          <Text style={[styles.featureText, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>
            Regional pricing
          </Text>
        </View>
        <View style={styles.emptyFeature}>
          <FontAwesome name="check-circle" size={16} color="#10B981" />
          <Text style={[styles.featureText, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>
            Updated in real-time
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function PricesScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { settings } = useStore();

  // Use state from settings (set during onboarding, editable in settings)
  const region = settings?.state || 'TX';
  const regionLabel = getRegions().find(r => r.value === region)?.label || region;

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [results, setResults] = useState<BlitzPricesResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performSearch = useCallback(async () => {
    if (!search.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await searchBlitzPrices(search.trim(), region, {
        category: selectedCategory as any,
        limit: 20,
      });
      setResults(response.results);
      setHasSearched(true);
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [search, region, selectedCategory]);

  const handleSearchSubmit = () => {
    performSearch();
  };

  const categories = getCategories();

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F9FAFB' }]}>
      {/* Region Indicator (set in Settings) */}
      <View style={[styles.regionIndicator, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
        <FontAwesome name="map-marker" size={14} color="#3B82F6" />
        <Text style={[styles.regionText, { color: isDark ? '#FFFFFF' : '#111827' }]}>
          {regionLabel}
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBox, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
          <FontAwesome name="search" size={16} color={isDark ? '#6B7280' : '#9CA3AF'} />
          <TextInput
            style={[styles.searchInput, { color: isDark ? '#FFFFFF' : '#111827' }]}
            placeholder="Search materials, equipment, fees..."
            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); setResults([]); setHasSearched(false); }}>
              <FontAwesome name="times-circle" size={16} color={isDark ? '#6B7280' : '#9CA3AF'} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Filter */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterChip,
            {
              backgroundColor: !selectedCategory
                ? '#3B82F6'
                : (isDark ? '#1F2937' : '#FFFFFF'),
            },
          ]}
          onPress={() => setSelectedCategory(null)}>
          <Text
            style={[
              styles.filterChipText,
              { color: !selectedCategory ? '#FFFFFF' : (isDark ? '#9CA3AF' : '#6B7280') },
            ]}>
            All
          </Text>
        </TouchableOpacity>
        {categories.map((cat) => {
          const config = CATEGORY_CONFIG[cat.value];
          return (
            <TouchableOpacity
              key={cat.value}
              style={[
                styles.filterChip,
                {
                  backgroundColor: selectedCategory === cat.value
                    ? config.color
                    : (isDark ? '#1F2937' : '#FFFFFF'),
                },
              ]}
              onPress={() => setSelectedCategory(selectedCategory === cat.value ? null : cat.value)}>
              <FontAwesome
                name={config.icon as any}
                size={12}
                color={selectedCategory === cat.value ? '#FFFFFF' : config.color}
              />
              <Text
                style={[
                  styles.filterChipText,
                  { color: selectedCategory === cat.value ? '#FFFFFF' : (isDark ? '#9CA3AF' : '#6B7280') },
                ]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Error */}
      {error && (
        <View style={styles.errorContainer}>
          <FontAwesome name="exclamation-circle" size={16} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Loading */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={[styles.loadingText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            Searching BlitzPrices...
          </Text>
        </View>
      )}

      {/* Results */}
      {!isLoading && (
        <FlatList
          data={results}
          keyExtractor={(item, index) => `${item.name}-${index}`}
          renderItem={({ item }) => <PriceCard item={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState hasSearched={hasSearched} />}
        />
      )}

      {/* FAB - Add Price */}
      <Link href="/pricebook/add" asChild>
        <TouchableOpacity style={styles.fab}>
          <FontAwesome name="plus" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  regionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  regionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 5,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 11,
    textTransform: 'capitalize',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    lineHeight: 22,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 22,
    fontWeight: '700',
  },
  unit: {
    fontSize: 14,
    marginLeft: 2,
  },
  rangeContainer: {
    alignItems: 'flex-end',
  },
  rangeText: {
    fontSize: 12,
  },
  sampleText: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 40,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  emptyFeatures: {
    marginTop: 24,
    gap: 12,
  },
  emptyFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 15,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 24,
    gap: 8,
  },
  emptyAddButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
