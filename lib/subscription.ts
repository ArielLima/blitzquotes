import { supabase } from './supabase';
import { hasProAccess, syncSubscriptionStatus, getCustomerInfo } from './revenuecat';
import type { SubscriptionStatus } from '../types';

const FREE_QUOTES_PER_MONTH = 3;
const SUBSCRIPTION_PRICE_MONTHLY = 25; // $25/month
const SUBSCRIPTION_PRICE_YEARLY = 200; // $200/year (save $100)

export interface QuotaInfo {
  canCreateQuote: boolean;
  quotesUsed: number;
  quotesRemaining: number;
  subscriptionStatus: SubscriptionStatus;
  isSubscribed: boolean;
}

/**
 * Get the start of the current month in ISO format
 */
function getMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

/**
 * Check user's quota status
 * Uses RevenueCat as source of truth, syncs to Supabase
 */
export async function checkQuota(userId: string): Promise<QuotaInfo> {
  // Check RevenueCat for subscription status (source of truth)
  let isSubscribed = false;
  let subscriptionStatus: SubscriptionStatus = 'free';

  try {
    isSubscribed = await hasProAccess();

    if (isSubscribed) {
      subscriptionStatus = 'active';
      // Sync to Supabase
      const customerInfo = await getCustomerInfo();
      await syncSubscriptionStatus(userId, customerInfo);
    }
  } catch (error) {
    // If RevenueCat fails, fall back to Supabase
    console.log('RevenueCat check failed, using Supabase:', error);
    const { data: settings } = await supabase
      .from('user_settings')
      .select('subscription_status')
      .eq('user_id', userId)
      .single();

    subscriptionStatus = settings?.subscription_status || 'free';
    isSubscribed = subscriptionStatus === 'active';
  }

  // Subscribers have unlimited quotes
  if (isSubscribed) {
    return {
      canCreateQuote: true,
      quotesUsed: 0,
      quotesRemaining: Infinity,
      subscriptionStatus,
      isSubscribed: true,
    };
  }

  // Count quotes created this month
  const monthStart = getMonthStart();
  const { count } = await supabase
    .from('quotes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', monthStart);

  const quotesUsed = count || 0;
  const quotesRemaining = Math.max(0, FREE_QUOTES_PER_MONTH - quotesUsed);

  return {
    canCreateQuote: quotesUsed < FREE_QUOTES_PER_MONTH,
    quotesUsed,
    quotesRemaining,
    subscriptionStatus,
    isSubscribed: false,
  };
}

/**
 * Get subscription price info
 */
export function getSubscriptionInfo() {
  return {
    priceMonthly: SUBSCRIPTION_PRICE_MONTHLY,
    priceYearly: SUBSCRIPTION_PRICE_YEARLY,
    price: SUBSCRIPTION_PRICE_MONTHLY, // Default for backwards compat
    freeQuotesPerMonth: FREE_QUOTES_PER_MONTH,
  };
}
