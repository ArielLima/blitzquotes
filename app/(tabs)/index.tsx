import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import { Link } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useStore } from '@/lib/store';
import { formatCurrency, timeAgo, getStatusColor, getStatusLabel } from '@/lib/utils';
import type { Quote } from '@/types';

function QuoteCard({ quote }: { quote: Quote }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Link href={`/quote/${quote.id}`} asChild>
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: isDark ? '#374151' : '#FFFFFF' },
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
          <Text style={[styles.date, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            {timeAgo(quote.created_at)}
          </Text>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

function EmptyState() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={styles.emptyState}>
      <FontAwesome name="file-text-o" size={48} color={isDark ? '#4B5563' : '#D1D5DB'} />
      <Text style={[styles.emptyTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
        No quotes yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
        Create your first quote to get started
      </Text>
    </View>
  );
}

export default function QuotesScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { quotes } = useStore();

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
      {quotes.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={quotes}
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
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 12,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
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
