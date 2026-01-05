import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  Alert,
  Modal,
  TextInput,
  Switch,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '@/lib/store';
import { signOut, supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';
import { PAYMENT_METHODS } from '@/lib/payments';
import { getRegions } from '@/lib/blitzprices';
import { formatPhone } from '@/lib/utils';
import { checkQuota, getSubscriptionInfo, type QuotaInfo } from '@/lib/subscription';
import PaywallModal from '@/components/PaywallModal';
import RevenueCatUI from 'react-native-purchases-ui';

// Edit Modal Component
function EditModal({
  visible,
  onClose,
  title,
  value,
  onSave,
  keyboardType = 'default',
  placeholder,
  prefix,
  suffix,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  value: string;
  onSave: (value: string) => void;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'email-address' | 'phone-pad';
  placeholder?: string;
  prefix?: string;
  suffix?: string;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [inputValue, setInputValue] = useState(value);

  // Reset input value when modal opens with new value
  useEffect(() => {
    if (visible) {
      setInputValue(value);
    }
  }, [visible, value]);

  const handleSave = () => {
    onSave(inputValue);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.editModalContent, { backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary }]}>
          <Text style={[styles.editModalTitle, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
            {title}
          </Text>
          <View style={[styles.editInputWrapper, { backgroundColor: isDark ? colors.gray[700] : colors.gray[100] }]}>
            {prefix && (
              <Text style={[styles.inputAffix, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>{prefix}</Text>
            )}
            <TextInput
              style={[styles.editInput, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}
              value={inputValue}
              onChangeText={setInputValue}
              keyboardType={keyboardType}
              placeholder={placeholder}
              placeholderTextColor={isDark ? colors.text.placeholderDark : colors.text.placeholder}
              autoFocus
            />
            {suffix && (
              <Text style={[styles.inputAffix, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>{suffix}</Text>
            )}
          </View>
          <View style={styles.editModalButtons}>
            <TouchableOpacity style={styles.editModalCancel} onPress={onClose}>
              <Text style={[styles.editModalCancelText, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.editModalSave} onPress={handleSave}>
              <Text style={styles.editModalSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Picker Modal Component
function PickerModal({
  visible,
  onClose,
  title,
  options,
  selected,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.pickerModalContent, { backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary }]}>
          <View style={styles.pickerModalHeader}>
            <Text style={[styles.pickerModalTitle, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <FontAwesome name="times" size={20} color={isDark ? colors.text.secondaryDark : colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            style={styles.pickerList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  selected === item.value && { backgroundColor: isDark ? colors.gray[700] : colors.gray[100] },
                ]}
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}>
                <Text style={[styles.pickerOptionText, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                  {item.label}
                </Text>
                {selected === item.value && (
                  <FontAwesome name="check" size={16} color={colors.primary.blue} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

function SettingsRow({
  icon,
  iconColor,
  label,
  value,
  onPress,
  isLast,
}: {
  icon: string;
  iconColor?: string;
  label: string;
  value?: string;
  onPress?: () => void;
  isLast?: boolean;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <TouchableOpacity
      style={[
        styles.row,
        { backgroundColor: isDark ? colors.gray[700] : colors.background.secondary },
        isLast && styles.rowLast,
      ]}
      onPress={onPress}
      disabled={!onPress}>
      <View style={styles.rowLeft}>
        <FontAwesome
          name={icon as any}
          size={18}
          color={iconColor || colors.primary.blue}
          style={styles.rowIcon}
        />
        <Text style={[styles.rowLabel, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
          {label}
        </Text>
      </View>
      <View style={styles.rowRight}>
        {value && (
          <Text style={[styles.rowValue, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]} numberOfLines={1}>
            {value}
          </Text>
        )}
        {onPress && (
          <View style={styles.rowChevron}>
            <FontAwesome
              name="chevron-right"
              size={14}
              color={isDark ? colors.gray[600] : colors.gray[300]}
            />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  value,
  onValueChange,
  isLast,
}: {
  icon: string;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  isLast?: boolean;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      style={[
        styles.row,
        styles.toggleRow,
        { backgroundColor: isDark ? colors.gray[700] : colors.background.secondary },
        isLast && styles.rowLast,
      ]}>
      <View style={styles.rowLeft}>
        <FontAwesome name={icon as any} size={18} color={colors.primary.blue} style={styles.rowIcon} />
        <View style={styles.toggleTextContainer}>
          <Text style={[styles.rowLabel, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
            {label}
          </Text>
          {description && (
            <Text style={[styles.toggleDescription, { color: isDark ? colors.text.placeholderDark : colors.text.placeholder }]}>
              {description}
            </Text>
          )}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.gray[500], true: colors.primary.blue }}
        thumbColor={value ? colors.text.inverse : colors.gray[100]}
      />
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Text style={[styles.sectionHeader, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
      {title}
    </Text>
  );
}

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { settings, user, setUser, setSettings } = useStore();

  // Edit modals state
  const [editModal, setEditModal] = useState<{
    visible: boolean;
    field: string;
    title: string;
    value: string;
    keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'email-address' | 'phone-pad';
    prefix?: string;
    suffix?: string;
  }>({ visible: false, field: '', title: '', value: '' });

  const [statePickerVisible, setStatePickerVisible] = useState(false);
  const [paymentPickerVisible, setPaymentPickerVisible] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);

  // Fetch quota info on mount
  useEffect(() => {
    if (user) {
      checkQuota(user.id).then(setQuotaInfo).catch(console.error);
    }
  }, [user]);

  const handleSubscribe = useCallback(async () => {
    // Refresh quota info after successful subscription
    if (user) {
      const updatedQuota = await checkQuota(user.id);
      setQuotaInfo(updatedQuota);
    }
    setShowPaywall(false);
  }, [user]);

  const handleManageSubscription = useCallback(async () => {
    try {
      await RevenueCatUI.presentCustomerCenter();
    } catch (error) {
      console.error('Failed to open customer center:', error);
      Alert.alert('Error', 'Unable to open subscription management. Please try again.');
    }
  }, []);

  const pickAndUploadLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) return;

      setUploadingLogo(true);

      const asset = result.assets[0];
      const fileExt = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user?.id}/logo.${fileExt}`;

      // Fetch the image and convert to blob
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      // Convert blob to ArrayBuffer for Supabase
      const arrayBuffer = await new Response(blob).arrayBuffer();

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, arrayBuffer, {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);

      // Add cache-busting parameter
      const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update settings with logo URL
      await updateSetting('logo_url', logoUrl);
    } catch (error: any) {
      console.error('Logo upload error:', error);
      Alert.alert('Error', error.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const updateSetting = async (field: string, value: any) => {
    if (!user || !settings) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) throw error;

      setSettings({ ...settings, [field]: value });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update setting');
    }
  };

  const openEditModal = (
    field: string,
    title: string,
    value: string,
    options?: {
      keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'email-address' | 'phone-pad';
      prefix?: string;
      suffix?: string;
    }
  ) => {
    setEditModal({
      visible: true,
      field,
      title,
      value,
      ...options,
    });
  };

  const handleEditSave = (value: string) => {
    const field = editModal.field;
    let processedValue: any = value;

    // Process numeric fields
    if (field === 'labor_rate') {
      processedValue = parseFloat(value) || 0;
    } else if (['material_markup', 'fee_markup', 'default_tax_rate', 'contractor_discount'].includes(field)) {
      // Convert percentage to decimal
      processedValue = (parseFloat(value) || 0) / 100;
    }

    updateSetting(field, processedValue);
  };

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

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return 'Not set';
    return `$${value.toFixed(0)}/hr`;
  };

  const formatPercent = (value?: number) => {
    if (value === undefined || value === null) return 'Not set';
    return `${(value * 100).toFixed(0)}%`;
  };

  const paymentMethodConfig = settings?.payment_method ? PAYMENT_METHODS[settings.payment_method] : null;
  const paymentMethodLabel = paymentMethodConfig
    ? (paymentMethodConfig.shortLabel || paymentMethodConfig.label)
    : 'Not set';

  const stateLabel = settings?.state
    ? getRegions().find(r => r.value === settings.state)?.label || settings.state
    : 'Not set';

  const paymentOptions = Object.entries(PAYMENT_METHODS).map(([key, val]) => ({
    value: key,
    label: val.label,
  }));

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: isDark ? colors.background.secondaryDark : colors.background.tertiary }]}
      contentContainerStyle={styles.content}>

      {/* Business Header Card */}
      <View style={[styles.businessCard, { backgroundColor: isDark ? colors.gray[700] : colors.background.secondary }]}>
        <TouchableOpacity
          style={styles.logoContainer}
          onPress={pickAndUploadLogo}
          disabled={uploadingLogo}>
          {uploadingLogo ? (
            <View style={[styles.logoPlaceholder, { backgroundColor: isDark ? colors.gray[600] : colors.gray[200] }]}>
              <ActivityIndicator color={colors.primary.blue} />
            </View>
          ) : settings?.logo_url ? (
            <Image source={{ uri: settings.logo_url }} style={styles.logo} />
          ) : (
            <View style={[styles.logoPlaceholder, { backgroundColor: isDark ? colors.gray[600] : colors.gray[200] }]}>
              <FontAwesome name="camera" size={20} color={isDark ? colors.text.secondaryDark : colors.text.secondary} />
            </View>
          )}
          <View style={styles.logoEditBadge}>
            <FontAwesome name="pencil" size={10} color={colors.text.inverse} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.businessNameContainer}
          onPress={() => openEditModal('business_name', 'Business Name', settings?.business_name || '')}
          activeOpacity={0.7}>
          <Text
            style={[styles.businessCardName, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.75}>
            {settings?.business_name || 'Your Business'}
          </Text>
          <FontAwesome name="pencil" size={14} color={isDark ? colors.text.placeholderDark : colors.text.placeholder} />
        </TouchableOpacity>
      </View>

      {/* Subscription Row */}
      {quotaInfo && !quotaInfo.isSubscribed && (
        <TouchableOpacity
          style={[styles.subscriptionRow, { backgroundColor: isDark ? colors.gray[700] : colors.background.secondary }]}
          onPress={() => setShowPaywall(true)}
          activeOpacity={0.7}>
          <Text style={[styles.subscriptionText, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
            {quotaInfo.quotesRemaining} of {getSubscriptionInfo().freeQuotesPerMonth} free quotes left
          </Text>
          <Text style={styles.upgradeLink}>Upgrade</Text>
        </TouchableOpacity>
      )}

      {quotaInfo?.isSubscribed && (
        <TouchableOpacity
          style={[styles.subscriptionRow, { backgroundColor: isDark ? colors.gray[700] : colors.background.secondary }]}
          onPress={handleManageSubscription}
          activeOpacity={0.7}>
          <Text style={[styles.subscriptionText, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
            Pro Plan
          </Text>
          <Text style={[styles.manageLink, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>Manage</Text>
        </TouchableOpacity>
      )}

      <SectionHeader title="CONTACT" />
      <View style={styles.section}>
        <SettingsRow
          icon="phone"
          label="Phone"
          value={settings?.business_phone ? formatPhone(settings.business_phone) : 'Not set'}
          onPress={() => openEditModal('business_phone', 'Phone Number', settings?.business_phone || '', { keyboardType: 'phone-pad' })}
        />
        <SettingsRow
          icon="envelope"
          label="Email"
          value={settings?.business_email || 'Not set'}
          onPress={() => openEditModal('business_email', 'Business Email', settings?.business_email || '', { keyboardType: 'email-address' })}
        />
        <SettingsRow
          icon="map-marker"
          label="State"
          value={stateLabel}
          onPress={() => setStatePickerVisible(true)}
        />
        <SettingsRow
          icon="map"
          label="ZIP Code"
          value={settings?.zip_code || 'Not set'}
          onPress={() => openEditModal('zip_code', 'ZIP Code', settings?.zip_code || '', { keyboardType: 'numeric' })}
        />
        <SettingsRow
          icon="building"
          label="Address"
          value={settings?.business_address || 'Not set'}
          onPress={() => openEditModal('business_address', 'Business Address', settings?.business_address || '')}
          isLast
        />
      </View>

      <SectionHeader title="PRICING" />
      <View style={styles.section}>
        <SettingsRow
          icon="dollar"
          label="Labor Rate"
          value={formatCurrency(settings?.labor_rate)}
          onPress={() => openEditModal('labor_rate', 'Labor Rate ($/hr)', settings?.labor_rate?.toString() || '100', { keyboardType: 'decimal-pad', prefix: '$', suffix: '/hr' })}
        />
        <SettingsRow
          icon="tag"
          iconColor={colors.status.success}
          label="Contractor Discount"
          value={formatPercent(settings?.contractor_discount ?? 0)}
          onPress={() => openEditModal('contractor_discount', 'Contractor Discount (%)', ((settings?.contractor_discount || 0) * 100).toFixed(0), { keyboardType: 'decimal-pad', suffix: '%' })}
        />
        <SettingsRow
          icon="cube"
          iconColor={colors.primary.blue}
          label="Material Markup"
          value={formatPercent(settings?.material_markup)}
          onPress={() => openEditModal('material_markup', 'Material Markup (%)', ((settings?.material_markup || 0.35) * 100).toFixed(0), { keyboardType: 'decimal-pad', suffix: '%' })}
        />
        <SettingsRow
          icon="file-text-o"
          iconColor={colors.special.purple}
          label="Fee Markup"
          value={formatPercent(settings?.fee_markup ?? 0)}
          onPress={() => openEditModal('fee_markup', 'Fee Markup (%)', ((settings?.fee_markup || 0) * 100).toFixed(0), { keyboardType: 'decimal-pad', suffix: '%' })}
          isLast
        />
      </View>

      <SectionHeader title="TAX" />
      <View style={styles.section}>
        <SettingsRow
          icon="percent"
          label="Default Tax Rate"
          value={formatPercent(settings?.default_tax_rate)}
          onPress={() => openEditModal('default_tax_rate', 'Default Tax Rate (%)', ((settings?.default_tax_rate || 0) * 100).toFixed(1), { keyboardType: 'decimal-pad', suffix: '%' })}
          isLast
        />
      </View>

      <SectionHeader title="PAYMENTS" />
      <View style={styles.section}>
        <SettingsRow
          icon="credit-card"
          label="Payment Method"
          value={paymentMethodLabel}
          onPress={() => setPaymentPickerVisible(true)}
        />
        {settings?.payment_method && settings.payment_method !== 'none' && (
          <>
            <SettingsRow
              icon="link"
              label="Payment Link"
              value={settings?.payment_link || 'Not set'}
              onPress={() => openEditModal('payment_link', 'Payment Link', settings?.payment_link || '')}
            />
            {PAYMENT_METHODS[settings.payment_method]?.helpText && (
              <View style={[styles.helpTextRow, { backgroundColor: isDark ? colors.gray[700] : colors.background.secondary }]}>
                <FontAwesome name="info-circle" size={14} color={isDark ? colors.text.placeholderDark : colors.text.placeholder} />
                <Text style={[styles.helpText, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                  {PAYMENT_METHODS[settings.payment_method].helpText}
                </Text>
              </View>
            )}
          </>
        )}
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
            styles.rowLast,
            { backgroundColor: isDark ? colors.gray[700] : colors.background.secondary },
          ]}
          onPress={handleSignOut}>
          <View style={styles.rowLeft}>
            <FontAwesome name="sign-out" size={18} color={colors.status.error} style={styles.rowIcon} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={[styles.version, { color: isDark ? colors.gray[600] : colors.gray[400] }]}>
        BlitzQuotes v1.0.0
      </Text>

      {/* Edit Modal */}
      <EditModal
        visible={editModal.visible}
        onClose={() => setEditModal({ ...editModal, visible: false })}
        title={editModal.title}
        value={editModal.value}
        onSave={handleEditSave}
        keyboardType={editModal.keyboardType}
        prefix={editModal.prefix}
        suffix={editModal.suffix}
      />

      {/* State Picker */}
      <PickerModal
        visible={statePickerVisible}
        onClose={() => setStatePickerVisible(false)}
        title="Select State"
        options={getRegions()}
        selected={settings?.state || ''}
        onSelect={(value) => updateSetting('state', value)}
      />

      {/* Payment Method Picker */}
      <PickerModal
        visible={paymentPickerVisible}
        onClose={() => setPaymentPickerVisible(false)}
        title="Payment Method"
        options={paymentOptions}
        selected={settings?.payment_method || 'none'}
        onSelect={(value) => updateSetting('payment_method', value)}
      />

      {/* Paywall Modal */}
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onSubscribe={handleSubscribe}
        quotesUsed={quotaInfo?.quotesUsed || 0}
      />
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
  businessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    gap: 14,
  },
  logoContainer: {
    position: 'relative',
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  logoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  businessNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  businessCardName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
  },
  helpTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  helpText: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
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
    borderBottomColor: colors.border.light,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  toggleRow: {
    paddingVertical: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
    textAlign: 'right',
    flexShrink: 1,
  },
  rowChevron: {
    width: 20,
    alignItems: 'flex-end',
  },
  toggleTextContainer: {
    flex: 1,
  },
  toggleDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  signOutText: {
    fontSize: 16,
    color: colors.status.error,
  },
  version: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 13,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModalContent: {
    width: '85%',
    borderRadius: 16,
    padding: 24,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  editInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 50,
  },
  editInput: {
    flex: 1,
    fontSize: 18,
    height: '100%',
  },
  inputAffix: {
    fontSize: 18,
    marginHorizontal: 4,
  },
  editModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 12,
  },
  editModalCancel: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  editModalCancelText: {
    fontSize: 16,
  },
  editModalSave: {
    backgroundColor: colors.primary.blue,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  editModalSaveText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  pickerModalContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  pickerOptionText: {
    fontSize: 16,
  },
  // Subscription row styles
  subscriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  subscriptionText: {
    fontSize: 14,
  },
  upgradeLink: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary.blue,
  },
  manageLink: {
    fontSize: 14,
  },
});
