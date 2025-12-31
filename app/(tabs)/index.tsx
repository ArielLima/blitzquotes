import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  useColorScheme,
  TextInput,
  ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useStore } from '@/lib/store';
import { formatCurrency, timeAgo, getStatusColor, getStatusLabel } from '@/lib/utils';
import type { Quote } from '@/types';

type FilterType = 'all' | 'draft' | 'sent' | 'viewed';

function QuoteCard({ quote }: { quote: Quote }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const showViewedIndicator = quote.status === 'viewed' && quote.viewed_at;

  return (
    <Link href={`/quote/${quote.id}`} asChild>
      <TouchableOpacity activeOpacity={0.7}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            },
          ]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.customerName, { color: isDark ? '#FFFFFF' : '#111827' }]}>
              {quote.customer_name}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(quote.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(quote.status) }]}>
                {getStatusLabel(quote.status)}
              </Text>
            </View>
          </View>

          <Text
            style={[styles.jobDescription, { color: isDark ? '#9CA3AF' : '#6B7280' }]}
            numberOfLines={1}>
            {quote.job_description || 'No description'}
          </Text>

          <View style={styles.cardFooter}>
            <Text style={[styles.total, { color: isDark ? '#FFFFFF' : '#111827' }]}>
              {formatCurrency(quote.total)}
            </Text>
            <View style={styles.footerRight}>
              {showViewedIndicator && (
                <View style={styles.viewedIndicator}>
                  <FontAwesome name="eye" size={12} color="#F59E0B" />
                  <Text style={styles.viewedText}>
                    {timeAgo(quote.viewed_at!)}
                  </Text>
                </View>
              )}
              <Text style={[styles.date, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
                {timeAgo(quote.created_at)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

function FilterChip({ label, active, onPress, count }: { label: string; active: boolean; onPress: () => void; count: number }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <TouchableOpacity
      style={[
        styles.filterChip,
        { backgroundColor: active ? '#3B82F6' : (isDark ? '#374151' : '#E5E7EB') },
      ]}
      onPress={onPress}>
      <Text style={[styles.filterLabel, { color: active ? '#FFFFFF' : (isDark ? '#D1D5DB' : '#374151') }]}>
        {label}
      </Text>
      {active && count > 0 && (
        <View style={[styles.filterCount, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Text style={[styles.filterCountText, { color: '#FFFFFF' }]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function EmptyState({ filter }: { filter: FilterType }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const messages: Record<FilterType, { title: string; subtitle: string }> = {
    all: { title: 'No quotes yet', subtitle: 'Create your first quote to get started' },
    draft: { title: 'No drafts', subtitle: 'Draft quotes will appear here' },
    sent: { title: 'No sent quotes', subtitle: 'Quotes you send will appear here' },
    viewed: { title: 'No viewed quotes', subtitle: 'Quotes your customers view will appear here' },
  };

  return (
    <View style={styles.emptyState}>
      <FontAwesome name="file-text-o" size={48} color={isDark ? '#4B5563' : '#D1D5DB'} />
      <Text style={[styles.emptyTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
        {messages[filter].title}
      </Text>
      <Text style={[styles.emptySubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
        {messages[filter].subtitle}
      </Text>
    </View>
  );
}

export default function QuotesScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { quotes } = useStore();
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Only show pending quotes (draft, sent, viewed) - not jobs (approved, invoiced, paid)
  const quotesOnly = useMemo(() => {
    return quotes.filter(q => ['draft', 'sent', 'viewed'].includes(q.status));
  }, [quotes]);

  const stats = useMemo(() => {
    const draftQuotes = quotesOnly.filter(q => q.status === 'draft');
    const sentQuotes = quotesOnly.filter(q => q.status === 'sent');
    const viewedQuotes = quotesOnly.filter(q => q.status === 'viewed');

    return {
      draftCount: draftQuotes.length,
      sentCount: sentQuotes.length,
      viewedCount: viewedQuotes.length,
    };
  }, [quotesOnly]);

  const filteredQuotes = useMemo(() => {
    let filtered = quotesOnly;

    // Apply status filter
    if (filter !== 'all') {
      filtered = filtered.filter(q => q.status === filter);
    }

    // Apply search filter with fuzzy matching
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const queryWords = query.split(/\s+/);

      filtered = filtered.filter(q => {
        const searchText = `${q.customer_name} ${q.job_description || ''}`.toLowerCase();
        // Match if all query words are found anywhere in the text
        return queryWords.every(word => searchText.includes(word));
      });
    }

    return filtered;
  }, [quotes, filter, searchQuery]);

  // Sort by created_at desc
  const sortedQuotes = useMemo(() => {
    return [...filteredQuotes].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [filteredQuotes]);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F3F4F6' }]}>
      {quotesOnly.length > 0 && (
        <View style={styles.header}>
          {/* Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterRow}>
            <FilterChip label="All" active={filter === 'all'} onPress={() => setFilter('all')} count={quotesOnly.length} />
            <FilterChip label="Draft" active={filter === 'draft'} onPress={() => setFilter('draft')} count={stats.draftCount} />
            <FilterChip label="Sent" active={filter === 'sent'} onPress={() => setFilter('sent')} count={stats.sentCount} />
            <FilterChip label="Viewed" active={filter === 'viewed'} onPress={() => setFilter('viewed')} count={stats.viewedCount} />
          </ScrollView>

          {/* Search Bar */}
          <View style={[styles.searchContainer, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
            <FontAwesome name="search" size={14} color={isDark ? '#6B7280' : '#9CA3AF'} />
            <TextInput
              style={[styles.searchInput, { color: isDark ? '#FFFFFF' : '#111827' }]}
              placeholder="Search by name or job..."
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <FontAwesome name="times-circle" size={14} color={isDark ? '#6B7280' : '#9CA3AF'} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {sortedQuotes.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <FlatList
          data={sortedQuotes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <QuoteCard quote={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Link href="/quote/new" asChild>
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
  header: {
    paddingTop: 8,
  },
  filterScroll: {
    flexGrow: 0,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    gap: 6,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  filterCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingTop: 8,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  jobDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  total: {
    fontSize: 18,
    fontWeight: '700',
  },
  footerRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  viewedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewedText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '500',
  },
  date: {
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
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
