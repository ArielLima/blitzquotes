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
  Modal,
} from 'react-native';
import { Link } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useStore, DATE_RANGE_OPTIONS, type DateRange } from '@/lib/store';
import { formatCurrency, timeAgo, getStatusColor, getStatusLabel } from '@/lib/utils';
import { colors } from '@/lib/colors';
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
              backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary,
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            },
          ]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.customerName, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
              {quote.customer_name}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(quote.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(quote.status) }]}>
                {getStatusLabel(quote.status)}
              </Text>
            </View>
          </View>

          <Text
            style={[styles.jobDescription, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}
            numberOfLines={1}>
            {quote.job_description || 'No description'}
          </Text>

          <View style={styles.cardFooter}>
            <Text style={[styles.total, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
              {formatCurrency(quote.total)}
            </Text>
            <View style={styles.footerRight}>
              {showViewedIndicator && (
                <View style={styles.viewedIndicator}>
                  <FontAwesome name="eye" size={12} color={colors.status.warning} />
                  <Text style={styles.viewedText}>
                    {timeAgo(quote.viewed_at!)}
                  </Text>
                </View>
              )}
              <Text style={[styles.date, { color: isDark ? colors.text.placeholderDark : colors.text.placeholder }]}>
                {timeAgo(quote.created_at)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={[styles.statCard, { backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary }]}>
      <Text style={[styles.statLabel, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
        {value}
      </Text>
    </View>
  );
}

function FilterChip({ label, active, onPress, count }: { label: string; active: boolean; onPress: () => void; count: number }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <TouchableOpacity
      style={[
        styles.filterChip,
        { backgroundColor: active ? colors.primary.blue : (isDark ? colors.border.dark : colors.border.light) },
      ]}
      onPress={onPress}>
      <Text style={[styles.filterLabel, { color: active ? colors.text.inverse : (isDark ? colors.gray[300] : colors.gray[700]) }]}>
        {label}
      </Text>
      {active && count > 0 && (
        <View style={[styles.filterCount, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Text style={[styles.filterCountText, { color: colors.text.inverse }]}>
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
      <FontAwesome name="file-text-o" size={48} color={isDark ? colors.gray[600] : colors.gray[300]} />
      <Text style={[styles.emptyTitle, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
        {messages[filter].title}
      </Text>
      <Text style={[styles.emptySubtitle, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
        {messages[filter].subtitle}
      </Text>
    </View>
  );
}

export default function QuotesScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { quotes, dateRange, setDateRange } = useStore();
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Only show pending quotes (draft, sent, viewed) - not jobs (approved, invoiced, paid)
  const quotesOnly = useMemo(() => {
    return quotes.filter(q => ['draft', 'sent', 'viewed'].includes(q.status));
  }, [quotes]);

  const stats = useMemo(() => {
    const draftQuotes = quotesOnly.filter(q => q.status === 'draft');
    const sentQuotes = quotesOnly.filter(q => q.status === 'sent');
    const viewedQuotes = quotesOnly.filter(q => q.status === 'viewed');

    // Calculate totals
    const draftTotal = draftQuotes.reduce((sum, q) => sum + q.total, 0);
    const sentTotal = sentQuotes.reduce((sum, q) => sum + q.total, 0);
    const viewedTotal = viewedQuotes.reduce((sum, q) => sum + q.total, 0);

    return {
      draftCount: draftQuotes.length,
      sentCount: sentQuotes.length,
      viewedCount: viewedQuotes.length,
      draftTotal,
      pendingTotal: sentTotal + viewedTotal,
      totalValue: draftTotal + sentTotal + viewedTotal,
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
    <View style={[styles.container, { backgroundColor: isDark ? colors.background.primaryDark : colors.background.tertiary }]}>
      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <StatCard
          label="Draft"
          value={formatCurrency(stats.draftTotal, { whole: true })}
        />
        <StatCard
          label="Pending"
          value={formatCurrency(stats.pendingTotal, { whole: true })}
        />
        <StatCard
          label="Total"
          value={formatCurrency(stats.totalValue, { whole: true })}
        />
      </View>

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
          <View style={[styles.searchContainer, { backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary }]}>
            <FontAwesome name="search" size={14} color={isDark ? colors.text.placeholderDark : colors.text.placeholder} />
            <TextInput
              style={[styles.searchInput, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}
              placeholder="Search by name or job..."
              placeholderTextColor={isDark ? colors.text.placeholderDark : colors.text.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <FontAwesome name="times-circle" size={14} color={isDark ? colors.text.placeholderDark : colors.text.placeholder} />
              </TouchableOpacity>
            )}
            <View style={[styles.searchDivider, { backgroundColor: isDark ? colors.border.dark : colors.border.light }]} />
            <TouchableOpacity
              style={styles.dateFilterButton}
              onPress={() => setShowDatePicker(true)}>
              <FontAwesome name="calendar" size={14} color={colors.primary.blue} />
              <Text style={styles.dateFilterText}>
                {DATE_RANGE_OPTIONS.find(o => o.value === dateRange)?.label.replace(' Days', 'd').replace(' Time', '')}
              </Text>
            </TouchableOpacity>
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
          <FontAwesome name="plus" size={24} color={colors.text.inverse} />
        </TouchableOpacity>
      </Link>

      {/* Date Range Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDatePicker(false)}>
          <View style={[styles.datePickerModal, { backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary }]}>
            <Text style={[styles.datePickerTitle, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
              Show quotes from
            </Text>
            {DATE_RANGE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.datePickerOption,
                  dateRange === option.value && styles.datePickerOptionActive,
                ]}
                onPress={() => {
                  setDateRange(option.value);
                  setShowDatePicker(false);
                }}>
                <Text style={[
                  styles.datePickerOptionText,
                  { color: isDark ? colors.text.primaryDark : colors.text.primary },
                  dateRange === option.value && styles.datePickerOptionTextActive,
                ]}>
                  {option.label}
                </Text>
                {dateRange === option.value && (
                  <FontAwesome name="check" size={16} color={colors.primary.blue} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  header: {
    paddingTop: 12,
    gap: 12,
  },
  filterScroll: {
    flexGrow: 0,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    shadowColor: colors.gray[950],
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
    marginBottom: 8,
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
    marginBottom: 14,
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
    color: colors.status.warning,
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
    backgroundColor: colors.primary.blue,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  searchDivider: {
    width: 1,
    height: 20,
    marginHorizontal: 8,
  },
  dateFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary.blue,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerModal: {
    width: '80%',
    maxWidth: 300,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.gray[950],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  datePickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  datePickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  datePickerOptionActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    marginHorizontal: -20,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  datePickerOptionText: {
    fontSize: 16,
  },
  datePickerOptionTextActive: {
    fontWeight: '600',
    color: colors.primary.blue,
  },
});
