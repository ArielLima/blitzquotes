import React, { useState, useMemo } from 'react';
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

function StatsCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={[styles.statCard, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
        <FontAwesome name={icon as any} size={16} color={color} />
      </View>
      <Text style={[styles.statValue, { color: isDark ? '#FFFFFF' : '#111827' }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>{label}</Text>
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
        { backgroundColor: active ? '#3B82F6' : (isDark ? '#374151' : '#E5E7EB') },
      ]}
      onPress={onPress}>
      <Text style={[styles.filterLabel, { color: active ? '#FFFFFF' : (isDark ? '#D1D5DB' : '#374151') }]}>
        {label}
      </Text>
      {count > 0 && (
        <View style={[styles.filterCount, { backgroundColor: active ? 'rgba(255,255,255,0.2)' : (isDark ? '#4B5563' : '#D1D5DB') }]}>
          <Text style={[styles.filterCountText, { color: active ? '#FFFFFF' : (isDark ? '#D1D5DB' : '#374151') }]}>
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

  const stats = useMemo(() => {
    const draftQuotes = quotes.filter(q => q.status === 'draft');
    const sentQuotes = quotes.filter(q => q.status === 'sent');
    const viewedQuotes = quotes.filter(q => q.status === 'viewed');

    return {
      draftCount: draftQuotes.length,
      sentCount: sentQuotes.length,
      viewedCount: viewedQuotes.length,
      draftTotal: draftQuotes.reduce((sum, q) => sum + q.total, 0),
      sentTotal: sentQuotes.reduce((sum, q) => sum + q.total, 0),
      viewedTotal: viewedQuotes.reduce((sum, q) => sum + q.total, 0),
    };
  }, [quotes]);

  const filteredQuotes = useMemo(() => {
    if (filter === 'all') return quotes;
    return quotes.filter(q => q.status === filter);
  }, [quotes, filter]);

  // Sort by created_at desc
  const sortedQuotes = useMemo(() => {
    return [...filteredQuotes].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [filteredQuotes]);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#F3F4F6' }]}>
      {quotes.length > 0 && (
        <View style={styles.header}>
          {/* Stats Row - Financial totals by status */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsRow} contentContainerStyle={styles.statsContent}>
            <StatsCard label="Drafts" value={formatCurrency(stats.draftTotal)} icon="edit" color="#6B7280" />
            <StatsCard label="Sent" value={formatCurrency(stats.sentTotal)} icon="send" color="#3B82F6" />
            <StatsCard label="Viewed" value={formatCurrency(stats.viewedTotal)} icon="eye" color="#F59E0B" />
          </ScrollView>

          {/* Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
            <FilterChip label="All" active={filter === 'all'} onPress={() => setFilter('all')} count={quotes.length} />
            <FilterChip label="Drafts" active={filter === 'draft'} onPress={() => setFilter('draft')} count={stats.draftCount} />
            <FilterChip label="Sent" active={filter === 'sent'} onPress={() => setFilter('sent')} count={stats.sentCount} />
            <FilterChip label="Viewed" active={filter === 'viewed'} onPress={() => setFilter('viewed')} count={stats.viewedCount} />
          </ScrollView>
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
  statsRow: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  statsContent: {
    gap: 10,
  },
  statCard: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterRow: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterContent: {
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
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
