import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  useColorScheme,
  ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useStore } from '@/lib/store';
import { formatCurrency, timeAgo, getStatusColor, getStatusLabel } from '@/lib/utils';
import type { Quote } from '@/types';

type JobFilter = 'all' | 'approved' | 'invoiced' | 'paid';

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

function StatCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={[styles.statCard, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
      <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
        <FontAwesome name={icon as any} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color: isDark ? '#FFFFFF' : '#111827' }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
        {label}
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
              backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            },
          ]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.customerName, { color: isDark ? '#FFFFFF' : '#111827' }]}>
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
            style={[styles.jobDescription, { color: isDark ? '#9CA3AF' : '#6B7280' }]}
            numberOfLines={1}>
            {quote.job_description || 'No description'}
          </Text>

          <View style={styles.cardFooter}>
            <View>
              <Text style={[styles.totalLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                Total
              </Text>
              <Text style={[styles.total, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                {formatCurrency(quote.total)}
              </Text>
            </View>
            {quote.status === 'paid' && (
              <View style={styles.profitContainer}>
                <Text style={[styles.profitLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  Profit
                </Text>
                <Text style={styles.profit}>
                  {formatCurrency(profit)}
                </Text>
              </View>
            )}
            <Text style={[styles.date, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
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
      <FontAwesome name="briefcase" size={48} color={isDark ? '#4B5563' : '#D1D5DB'} />
      <Text style={[styles.emptyTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
        {message.title}
      </Text>
      <Text style={[styles.emptySubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
        {message.subtitle}
      </Text>
    </View>
  );
}

export default function InvoicesScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { quotes } = useStore();
  const [filter, setFilter] = useState<JobFilter>('approved');

  // Get all jobs (approved, invoiced, paid)
  const allJobs = useMemo(() => {
    return quotes
      .filter(q => ['approved', 'invoiced', 'paid'].includes(q.status))
      .sort((a, b) => {
        const getDate = (q: Quote) => q.paid_at || q.invoiced_at || q.approved_at || q.created_at;
        return new Date(getDate(b)).getTime() - new Date(getDate(a)).getTime();
      });
  }, [quotes]);

  // Filter jobs based on selected filter
  const filteredJobs = useMemo(() => {
    if (filter === 'all') return allJobs;
    return allJobs.filter(q => q.status === filter);
  }, [allJobs, filter]);

  // Count by status
  const counts = useMemo(() => ({
    all: allJobs.length,
    approved: allJobs.filter(q => q.status === 'approved').length,
    invoiced: allJobs.filter(q => q.status === 'invoiced').length,
    paid: allJobs.filter(q => q.status === 'paid').length,
  }), [allJobs]);

  // Stats from paid jobs only
  const stats = useMemo(() => {
    const paidJobs = allJobs.filter(q => q.status === 'paid');
    let totalRevenue = 0;
    let totalProfit = 0;

    paidJobs.forEach(quote => {
      totalRevenue += quote.total;
      const materialsCost = quote.line_items.reduce((sum, item: any) => {
        return sum + (item.contractor_cost || item.unit_price * 0.7) * item.qty;
      }, 0);
      totalProfit += quote.total - materialsCost;
    });

    return { revenue: totalRevenue, profit: totalProfit };
  }, [allJobs]);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F3F4F6' }]}>
      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <StatCard
          label="Total Revenue"
          value={formatCurrency(stats.revenue)}
          color="#3B82F6"
          icon="dollar"
        />
        <StatCard
          label="Total Profit"
          value={formatCurrency(stats.profit)}
          color="#10B981"
          icon="line-chart"
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
    paddingTop: 16,
    gap: 12,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
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
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
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
    paddingBottom: 20,
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
    marginBottom: 12,
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
    color: '#10B981',
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
});
