import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  Alert,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useStore } from '@/lib/store';
import { signOut } from '@/lib/supabase';
import { PAYMENT_METHODS } from '@/lib/payments';

function SettingsRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <TouchableOpacity
      style={[
        styles.row,
        { backgroundColor: isDark ? '#374151' : '#FFFFFF' },
      ]}
      onPress={onPress}
      disabled={!onPress}>
      <View style={styles.rowLeft}>
        <FontAwesome
          name={icon as any}
          size={18}
          color="#3B82F6"
          style={styles.rowIcon}
        />
        <Text style={[styles.rowLabel, { color: isDark ? '#FFFFFF' : '#111827' }]}>
          {label}
        </Text>
      </View>
      <View style={styles.rowRight}>
        {value && (
          <Text style={[styles.rowValue, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            {value}
          </Text>
        )}
        {onPress && (
          <FontAwesome
            name="chevron-right"
            size={14}
            color={isDark ? '#4B5563' : '#D1D5DB'}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Text style={[styles.sectionHeader, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
      {title}
    </Text>
  );
}

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { settings, user, setUser } = useStore();

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            setUser(null);
          } catch (error) {
            Alert.alert('Error', 'Failed to sign out');
          }
        },
      },
    ]);
  };

  const paymentMethodLabel = settings?.payment_method
    ? PAYMENT_METHODS[settings.payment_method]?.label || 'Not set'
    : 'Not set';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}
      contentContainerStyle={styles.content}>
      <SectionHeader title="BUSINESS" />
      <View style={styles.section}>
        <SettingsRow
          icon="building"
          label="Business Name"
          value={settings?.business_name || 'Not set'}
          onPress={() => {}}
        />
        <SettingsRow
          icon="phone"
          label="Phone"
          value={settings?.business_phone || 'Not set'}
          onPress={() => {}}
        />
        <SettingsRow
          icon="envelope"
          label="Email"
          value={settings?.business_email || 'Not set'}
          onPress={() => {}}
        />
        <SettingsRow
          icon="map-marker"
          label="Address"
          value={settings?.business_address || 'Not set'}
          onPress={() => {}}
        />
      </View>

      <SectionHeader title="QUOTING" />
      <View style={styles.section}>
        <SettingsRow
          icon="percent"
          label="Default Tax Rate"
          value={settings ? `${(settings.default_tax_rate * 100).toFixed(1)}%` : 'Not set'}
          onPress={() => {}}
        />
        <SettingsRow
          icon="line-chart"
          label="Default Markup"
          value={settings ? `${(settings.default_markup * 100).toFixed(0)}%` : 'Not set'}
          onPress={() => {}}
        />
      </View>

      <SectionHeader title="PAYMENTS" />
      <View style={styles.section}>
        <SettingsRow
          icon="credit-card"
          label="Payment Method"
          value={paymentMethodLabel}
          onPress={() => {}}
        />
      </View>

      <SectionHeader title="ACCOUNT" />
      <View style={styles.section}>
        <SettingsRow
          icon="user"
          label="Email"
          value={user?.email || 'Unknown'}
        />
        <TouchableOpacity
          style={[
            styles.row,
            styles.signOutRow,
            { backgroundColor: isDark ? '#374151' : '#FFFFFF' },
          ]}
          onPress={handleSignOut}>
          <FontAwesome name="sign-out" size={18} color="#EF4444" style={styles.rowIcon} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.version, { color: isDark ? '#4B5563' : '#9CA3AF' }]}>
        BlitzQuotes v1.0.0
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  section: {
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowIcon: {
    width: 24,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 16,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    fontSize: 15,
  },
  signOutRow: {
    borderBottomWidth: 0,
  },
  signOutText: {
    fontSize: 16,
    color: '#EF4444',
  },
  version: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 13,
  },
});
