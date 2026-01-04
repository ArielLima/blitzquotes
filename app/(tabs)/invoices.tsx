import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  useColorScheme,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { Link } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useStore, DATE_RANGE_OPTIONS } from '@/lib/store';
import { formatCurrency, timeAgo, getStatusColor, getStatusLabel } from '@/lib/utils';
import { colors } from '@/lib/colors';
import type { Quote } from '@/types';

type JobFilter = 'all' | 'approved' | 'invoiced' | 'paid';

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

function JobCard({ quote }: { quote: Quote }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Calculate profit (simplified: total - materials cost)
  const materialsCost = quote.line_items.reduce((sum, item: any) => {
    return sum + (item.contractor_cost || item.unit_price * 0.7) * item.qty;
  }, 0);
  const profit = quote.total - materialsCost;

  const statusColor = getStatusColor(quote.status);

  // Get the most relevant date for this status
  const getRelevantDate = () => {
    if (quote.status === 'paid' && quote.paid_at) return timeAgo(quote.paid_at);
    if (quote.status === 'invoiced' && quote.invoiced_at) return timeAgo(quote.invoiced_at);
    if (quote.status === 'approved' && quote.approved_at) return timeAgo(quote.approved_at);
    return timeAgo(quote.created_at);
  };

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
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              {quote.status === 'paid' && <FontAwesome name="check-circle" size={12} color={statusColor} />}
              {quote.status === 'invoiced' && <FontAwesome name="file-text" size={12} color={statusColor} />}
              {quote.status === 'approved' && <FontAwesome name="thumbs-up" size={12} color={statusColor} />}
              <Text style={[styles.statusBadgeText, { color: statusColor }]}>
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
            <View>
              <Text style={[styles.totalLabel, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                Total
              </Text>
              <Text style={[styles.total, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                {formatCurrency(quote.total)}
              </Text>
            </View>
            {quote.status === 'paid' && (
              <View style={styles.profitContainer}>
                <Text style={[styles.profitLabel, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                  Profit
                </Text>
                <Text style={styles.profit}>
                  {formatCurrency(profit)}
                </Text>
              </View>
            )}
            <Text style={[styles.date, { color: isDark ? colors.text.placeholderDark : colors.text.placeholder }]}>
              {getRelevantDate()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

function EmptyState({ filter }: { filter: JobFilter }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const getMessage = () => {
    switch (filter) {
      case 'approved':
        return { title: 'No approved jobs', subtitle: 'Jobs approved by customers will appear here' };
      case 'invoiced':
        return { title: 'No invoices', subtitle: 'Convert approved quotes to invoices to see them here' };
      case 'paid':
        return { title: 'No paid jobs', subtitle: 'Jobs marked as paid will appear here' };
      default:
        return { title: 'No jobs yet', subtitle: 'Approved, invoiced, and paid jobs will appear here' };
    }
  };

  const message = getMessage();

  return (
    <View style={styles.emptyState}>
      <FontAwesome name="briefcase" size={48} color={isDark ? colors.gray[600] : colors.gray[300]} />
      <Text style={[styles.emptyTitle, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
        {message.title}
      </Text>
      <Text style={[styles.emptySubtitle, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
        {message.subtitle}
      </Text>
    </View>
  );
}

export default function InvoicesScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { quotes, dateRange, setDateRange } = useStore();
  const [filter, setFilter] = useState<JobFilter>('approved');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Get all jobs (approved, invoiced, paid)
  const allJobs = useMemo(() => {
    return quotes
      .filter(q => ['approved', 'invoiced', 'paid'].includes(q.status))
      .sort((a, b) => {
        const getDate = (q: Quote) => q.paid_at || q.invoiced_at || q.approved_at || q.created_at;
        return new Date(getDate(b)).getTime() - new Date(getDate(a)).getTime();
      });
  }, [quotes]);

  // Filter jobs based on selected filter and search
  const filteredJobs = useMemo(() => {
    let filtered = allJobs;

    // Apply status filter
    if (filter !== 'all') {
      filtered = filtered.filter(q => q.status === filter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const queryWords = query.split(/\s+/);
      filtered = filtered.filter(q => {
        const searchText = `${q.customer_name} ${q.job_description || ''}`.toLowerCase();
        return queryWords.every(word => searchText.includes(word));
      });
    }

    return filtered;
  }, [allJobs, filter, searchQuery]);

  // Count by status
  const counts = useMemo(() => ({
    all: allJobs.length,
    approved: allJobs.filter(q => q.status === 'approved').length,
    invoiced: allJobs.filter(q => q.status === 'invoiced').length,
    paid: allJobs.filter(q => q.status === 'paid').length,
  }), [allJobs]);

  // Stats calculations
  const stats = useMemo(() => {
    let paidRevenue = 0;
    let paidProfit = 0;
    let expectedRevenue = 0;

    allJobs.forEach(quote => {
      const materialsCost = quote.line_items.reduce((sum, item: any) => {
        return sum + (item.contractor_cost || item.unit_price * 0.7) * item.qty;
      }, 0);

      if (quote.status === 'paid') {
        paidRevenue += quote.total;
        paidProfit += quote.total - materialsCost;
      } else if (quote.status === 'approved' || quote.status === 'invoiced') {
        expectedRevenue += quote.total;
      }
    });

    return { paidRevenue, paidProfit, expectedRevenue };
  }, [allJobs]);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? colors.background.primaryDark : colors.background.tertiary }]}>
      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <StatCard
          label="Expected"
          value={formatCurrency(stats.expectedRevenue, { whole: true })}
        />
        <StatCard
          label="Collected"
          value={formatCurrency(stats.paidRevenue, { whole: true })}
        />
        <StatCard
          label="Profit"
          value={formatCurrency(stats.paidProfit, { whole: true })}
        />
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}>
        <FilterChip label="All" active={filter === 'all'} onPress={() => setFilter('all')} count={counts.all} />
        <FilterChip label="Approved" active={filter === 'approved'} onPress={() => setFilter('approved')} count={counts.approved} />
        <FilterChip label="Invoiced" active={filter === 'invoiced'} onPress={() => setFilter('invoiced')} count={counts.invoiced} />
        <FilterChip label="Paid" active={filter === 'paid'} onPress={() => setFilter('paid')} count={counts.paid} />
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

      <View style={styles.content}>
        {filteredJobs.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <FlatList
            data={filteredJobs}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <JobCard quote={item} />}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

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
              Show jobs from
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
  content: {
    flex: 1,
  },
  filterScroll: {
    flexGrow: 0,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
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
  statCard: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 12,
    marginLeft: 20,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
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
    alignItems: 'flex-end',
  },
  totalLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  total: {
    fontSize: 18,
    fontWeight: '700',
  },
  profitContainer: {
    alignItems: 'center',
  },
  profitLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  profit: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.status.success,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
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
