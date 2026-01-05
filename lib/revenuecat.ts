import Purchases, {
  LOG_LEVEL,
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// RevenueCat Configuration
const REVENUECAT_API_KEY = 'test_vlNLYOlxolpEclauOvLDXOrjiYm';
const ENTITLEMENT_ID = 'Blitzquotes Pro';

// Product identifiers (must match App Store Connect / Google Play)
export const PRODUCT_IDS = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const;

let isInitialized = false;

/**
 * Initialize RevenueCat SDK
 * Call this once when the app starts, after user authentication
 */
export async function initializeRevenueCat(userId?: string): Promise<void> {
  if (isInitialized) {
    // If already initialized but we have a new user, log in
    if (userId) {
      await loginRevenueCat(userId);
    }
    return;
  }

  try {
    // Enable debug logs in development
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    // Configure with API key
    Purchases.configure({
      apiKey: REVENUECAT_API_KEY,
      appUserID: userId || undefined,
    });

    isInitialized = true;
    console.log('RevenueCat initialized successfully');
  } catch (error) {
    console.error('Failed to initialize RevenueCat:', error);
    throw error;
  }
}

/**
 * Log in a user to RevenueCat
 * Call this after user authenticates with your backend
 */
export async function loginRevenueCat(userId: string): Promise<CustomerInfo> {
  try {
    const { customerInfo } = await Purchases.logIn(userId);

    // Sync subscription status to Supabase
    await syncSubscriptionStatus(userId, customerInfo);

    return customerInfo;
  } catch (error) {
    console.error('Failed to log in to RevenueCat:', error);
    throw error;
  }
}

/**
 * Log out from RevenueCat
 * Call this when user signs out
 */
export async function logoutRevenueCat(): Promise<void> {
  try {
    await Purchases.logOut();
  } catch (error) {
    console.error('Failed to log out from RevenueCat:', error);
  }
}

/**
 * Get current customer info
 */
export async function getCustomerInfo(): Promise<CustomerInfo> {
  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    console.error('Failed to get customer info:', error);
    throw error;
  }
}

/**
 * Check if user has active Pro subscription
 */
export async function hasProAccess(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch (error) {
    console.error('Failed to check pro access:', error);
    return false;
  }
}

/**
 * Get available offerings (products)
 */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (error) {
    console.error('Failed to get offerings:', error);
    return null;
  }
}

/**
 * Purchase a package
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<{
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);

    // Sync subscription status to Supabase
    const userId = customerInfo.originalAppUserId;
    if (userId) {
      await syncSubscriptionStatus(userId, customerInfo);
    }

    return { success: true, customerInfo };
  } catch (error: any) {
    // Check if user cancelled
    if (error.userCancelled) {
      return { success: false, error: 'cancelled' };
    }

    console.error('Purchase failed:', error);
    return { success: false, error: error.message || 'Purchase failed' };
  }
}

/**
 * Restore purchases (for users who reinstall or switch devices)
 */
export async function restorePurchases(): Promise<{
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}> {
  try {
    const customerInfo = await Purchases.restorePurchases();

    // Sync subscription status to Supabase
    const userId = customerInfo.originalAppUserId;
    if (userId) {
      await syncSubscriptionStatus(userId, customerInfo);
    }

    return { success: true, customerInfo };
  } catch (error: any) {
    console.error('Restore failed:', error);
    return { success: false, error: error.message || 'Restore failed' };
  }
}

/**
 * Sync RevenueCat subscription status to Supabase
 */
export async function syncSubscriptionStatus(
  userId: string,
  customerInfo: CustomerInfo
): Promise<void> {
  try {
    const hasAccess = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];

    let subscriptionStatus: 'free' | 'active' | 'canceled' = 'free';

    if (hasAccess) {
      subscriptionStatus = 'active';
    } else if (entitlement?.willRenew === false) {
      subscriptionStatus = 'canceled';
    }

    await supabase
      .from('user_settings')
      .update({ subscription_status: subscriptionStatus })
      .eq('user_id', userId);

    console.log('Subscription status synced:', subscriptionStatus);
  } catch (error) {
    console.error('Failed to sync subscription status:', error);
  }
}

/**
 * Set up listener for customer info changes
 * Returns cleanup function
 */
export function addCustomerInfoListener(
  callback: (customerInfo: CustomerInfo) => void
): () => void {
  Purchases.addCustomerInfoUpdateListener(callback);
  // Note: The listener is added globally and can't be individually removed
  // For cleanup, you would need to track this at the app level
  return () => {};
}

/**
 * Get subscription management URL (for Customer Center)
 */
export async function getManagementURL(): Promise<string | null> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.managementURL;
  } catch (error) {
    console.error('Failed to get management URL:', error);
    return null;
  }
}

/**
 * Get expiration date for active subscription
 */
export async function getSubscriptionExpirationDate(): Promise<Date | null> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];

    if (entitlement?.expirationDate) {
      return new Date(entitlement.expirationDate);
    }
    return null;
  } catch (error) {
    console.error('Failed to get expiration date:', error);
    return null;
  }
}
