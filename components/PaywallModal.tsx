import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors } from '@/lib/colors';
import { getSubscriptionInfo } from '@/lib/subscription';
import { getOfferings, purchasePackage, restorePurchases } from '@/lib/revenuecat';
import type { PurchasesPackage } from 'react-native-purchases';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubscribe: () => void;
  quotesUsed: number;
}

export default function PaywallModal({ visible, onClose, onSubscribe, quotesUsed }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { price, freeQuotesPerMonth } = getSubscriptionInfo();

  const [isLoading, setIsLoading] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);

  // Load offerings when modal opens
  useEffect(() => {
    if (visible) {
      loadOfferings();
    }
  }, [visible]);

  const loadOfferings = async () => {
    try {
      const offering = await getOfferings();
      if (offering?.availablePackages) {
        setPackages(offering.availablePackages);
        // Default to monthly
        const monthly = offering.availablePackages.find(p => p.identifier === '$rc_monthly');
        setSelectedPackage(monthly || offering.availablePackages[0]);
      }
    } catch (error) {
      console.error('Failed to load offerings:', error);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    setIsLoading(true);
    try {
      const result = await purchasePackage(selectedPackage);
      if (result.success) {
        onSubscribe();
        onClose();
      } else if (result.error && result.error !== 'cancelled') {
        Alert.alert('Purchase Failed', result.error);
      }
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsLoading(true);
    try {
      const result = await restorePurchases();
      if (result.success) {
        // Check if they now have access
        const customerInfo = result.customerInfo;
        if (customerInfo?.entitlements.active['Blitzquotes Pro']) {
          onSubscribe();
          onClose();
          Alert.alert('Success', 'Your subscription has been restored!');
        } else {
          Alert.alert('No Subscription Found', 'No active subscription was found for this account.');
        }
      } else {
        Alert.alert('Restore Failed', result.error || 'Please try again.');
      }
    } catch (error) {
      console.error('Restore error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Use RevenueCat's native paywall UI
  const handlePresentPaywall = async () => {
    try {
      const result = await RevenueCatUI.presentPaywall();

      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        onSubscribe();
        onClose();
      }
    } catch (error) {
      console.error('Paywall error:', error);
      // Fall back to showing custom UI
    }
  };

  const getPackagePrice = (pkg: PurchasesPackage) => {
    return pkg.product.priceString;
  };

  const getPackageLabel = (pkg: PurchasesPackage) => {
    if (pkg.identifier === '$rc_monthly' || pkg.packageType === 'MONTHLY') {
      return 'Monthly';
    }
    if (pkg.identifier === '$rc_annual' || pkg.packageType === 'ANNUAL') {
      return 'Yearly';
    }
    return pkg.identifier;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: isDark ? colors.background.primaryDark : colors.background.primary }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <FontAwesome name="times" size={18} color={isDark ? colors.text.secondaryDark : colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Pro Badge */}
          <View style={[styles.proBadge, { borderColor: isDark ? colors.border.dark : colors.border.light }]}>
            <Text style={[styles.proBadgeText, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>PRO</Text>
          </View>

          <Text style={[styles.title, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
            Upgrade to BlitzQuotes Pro
          </Text>

          <Text style={[styles.subtitle, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
            {quotesUsed} of {freeQuotesPerMonth} free quotes used this month
          </Text>

          {/* Features */}
          <View style={[styles.featuresCard, {
            backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary,
            borderColor: isDark ? colors.border.dark : colors.border.light,
          }]}>
            <View style={styles.feature}>
              <FontAwesome name="check" size={14} color={isDark ? colors.text.secondaryDark : colors.text.secondary} />
              <Text style={[styles.featureText, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                Unlimited quotes & invoices
              </Text>
            </View>
            <View style={styles.feature}>
              <FontAwesome name="check" size={14} color={isDark ? colors.text.secondaryDark : colors.text.secondary} />
              <Text style={[styles.featureText, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                AI-powered quote generation
              </Text>
            </View>
            <View style={styles.feature}>
              <FontAwesome name="check" size={14} color={isDark ? colors.text.secondaryDark : colors.text.secondary} />
              <Text style={[styles.featureText, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                Real-time notifications
              </Text>
            </View>
            <View style={styles.feature}>
              <FontAwesome name="check" size={14} color={isDark ? colors.text.secondaryDark : colors.text.secondary} />
              <Text style={[styles.featureText, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                Professional customer pages
              </Text>
            </View>
          </View>

          {/* Package Selection */}
          {packages.length > 0 && (
            <View style={styles.packagesContainer}>
              {packages.map((pkg) => (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[
                    styles.packageOption,
                    {
                      backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary,
                      borderColor: selectedPackage?.identifier === pkg.identifier
                        ? colors.primary.blue
                        : isDark ? colors.border.dark : colors.border.light,
                      borderWidth: selectedPackage?.identifier === pkg.identifier ? 2 : 1,
                    },
                  ]}
                  onPress={() => setSelectedPackage(pkg)}
                >
                  <View style={styles.packageInfo}>
                    <Text style={[styles.packageLabel, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                      {getPackageLabel(pkg)}
                    </Text>
                    {pkg.packageType === 'ANNUAL' && (
                      <View style={styles.saveBadge}>
                        <Text style={styles.saveBadgeText}>Save 33%</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.packagePrice, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                    {getPackagePrice(pkg)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Fallback price if no packages loaded */}
          {packages.length === 0 && (
            <View style={styles.priceContainer}>
              <Text style={[styles.price, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                ${price}
              </Text>
              <Text style={[styles.priceUnit, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                /month
              </Text>
            </View>
          )}

          <Text style={[styles.priceNote, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
            Cancel anytime. No commitment.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.subscribeButton, isLoading && styles.subscribeButtonDisabled]}
            onPress={handlePurchase}
            disabled={isLoading || !selectedPackage}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Text style={styles.subscribeButtonText}>Continue</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleRestore} disabled={isLoading}>
            <Text style={[styles.restoreText, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
              Restore Purchases
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.laterText, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
              Not now
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  proBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 20,
  },
  proBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 28,
  },
  featuresCard: {
    width: '100%',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 14,
    marginBottom: 24,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 15,
  },
  packagesContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
  packageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  packageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  packageLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  packagePrice: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveBadge: {
    backgroundColor: colors.status.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  saveBadgeText: {
    color: colors.text.inverse,
    fontSize: 11,
    fontWeight: '600',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  price: {
    fontSize: 40,
    fontWeight: '600',
  },
  priceUnit: {
    fontSize: 16,
    marginLeft: 4,
  },
  priceNote: {
    fontSize: 13,
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 12,
  },
  subscribeButton: {
    backgroundColor: colors.primary.blue,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  subscribeButtonDisabled: {
    opacity: 0.6,
  },
  subscribeButtonText: {
    color: colors.text.inverse,
    fontSize: 17,
    fontWeight: '600',
  },
  restoreText: {
    fontSize: 14,
  },
  laterText: {
    fontSize: 15,
  },
});
