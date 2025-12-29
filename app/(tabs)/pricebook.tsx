import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  SectionList,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import { Link } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import type { PricebookItem } from '@/types';

const CATEGORY_LABELS: Record<string, string> = {
  materials: 'Materials',
  labor: 'Labor',
  equipment: 'Equipment',
  fees: 'Fees',
};

const CATEGORY_ICONS: Record<string, string> = {
  materials: 'cube',
  labor: 'clock-o',
  equipment: 'wrench',
  fees: 'file-text-o',
};

function PricebookItemRow({ item }: { item: PricebookItem }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Link href={`/pricebook/${item.id}`} asChild>
      <TouchableOpacity
        style={[
          styles.itemRow,
          { backgroundColor: isDark ? '#374151' : '#FFFFFF' },
        ]}>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, { color: isDark ? '#FFFFFF' : '#111827' }]}>
            {item.name}
          </Text>
          <Text style={[styles.itemUnit, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            per {item.unit}
          </Text>
        </View>
        <View style={styles.itemPricing}>
          <Text style={[styles.itemPrice, { color: isDark ? '#FFFFFF' : '#111827' }]}>
            {formatCurrency(item.price)}
          </Text>
          {item.cost > 0 && (
            <Text style={[styles.itemCost, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              Cost: {formatCurrency(item.cost)}
            </Text>
          )}
        </View>
        <FontAwesome name="chevron-right" size={14} color={isDark ? '#4B5563' : '#D1D5DB'} />
      </TouchableOpacity>
    </Link>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={[styles.sectionHeader, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
      <FontAwesome
        name={icon as any}
        size={14}
        color={isDark ? '#9CA3AF' : '#6B7280'}
        style={styles.sectionIcon}
      />
      <Text style={[styles.sectionTitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
        {title}
      </Text>
    </View>
  );
}

function EmptyState() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconContainer, { backgroundColor: isDark ? '#1E3A5F' : '#DBEAFE' }]}>
        <FontAwesome name="magic" size={32} color="#3B82F6" />
      </View>
      <Text style={[styles.emptyTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
        Your pricebook builds itself
      </Text>
      <Text style={[styles.emptySubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
        Create your first quote and we'll suggest items with pricing. Save the ones you like to build your pricebook over time.
      </Text>
      <View style={styles.emptySteps}>
        <View style={styles.emptyStep}>
          <View style={[styles.stepNumber, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
            <Text style={[styles.stepNumberText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>1</Text>
          </View>
          <Text style={[styles.stepText, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>
            Describe a job
          </Text>
        </View>
        <View style={styles.emptyStep}>
          <View style={[styles.stepNumber, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
            <Text style={[styles.stepNumberText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>2</Text>
          </View>
          <Text style={[styles.stepText, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>
            AI suggests line items
          </Text>
        </View>
        <View style={styles.emptyStep}>
          <View style={[styles.stepNumber, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
            <Text style={[styles.stepNumberText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>3</Text>
          </View>
          <Text style={[styles.stepText, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>
            Save to pricebook
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function PricebookScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { pricebook } = useStore();

  // Group items by category
  const sections = React.useMemo(() => {
    const grouped: Record<string, PricebookItem[]> = {};
    pricebook.forEach((item) => {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    });

    return Object.entries(grouped).map(([category, items]) => ({
      title: CATEGORY_LABELS[category] || category,
      icon: CATEGORY_ICONS[category] || 'circle',
      data: items,
    }));
  }, [pricebook]);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
      {pricebook.length === 0 ? (
        <EmptyState />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PricebookItemRow item={item} />}
          renderSectionHeader={({ section }) => (
            <SectionHeader title={section.title} icon={section.icon} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

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
  list: {
    paddingBottom: 80,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
  },
  itemUnit: {
    fontSize: 13,
    marginTop: 2,
  },
  itemPricing: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemCost: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
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
  emptySteps: {
    marginTop: 32,
    gap: 16,
  },
  emptyStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '600',
  },
  stepText: {
    fontSize: 15,
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
