import type { PaymentMethod, UserSettings } from '../types';

interface PaymentConfig {
  label: string;
  icon: string;
  placeholder: string;
  detailsLabel?: string;
  detailsPlaceholder?: string;
  buildUrl: (link: string, amount: number, details?: string) => string | null;
  instructions?: (details: string, amount: number) => string;
}

export const PAYMENT_METHODS: Record<PaymentMethod, PaymentConfig> = {
  stripe: {
    label: 'Stripe (Recommended)',
    icon: 'credit-card',
    placeholder: 'https://buy.stripe.com/xxx',
    buildUrl: (link, amount) => {
      // Stripe Payment Links can accept amount as query param
      // Format: https://buy.stripe.com/xxx?line_items[0][quantity]=1
      // For simplicity, we just open the link - amount is set in Stripe dashboard
      return link;
    },
  },
  venmo: {
    label: 'Venmo',
    icon: 'smartphone',
    placeholder: 'your-venmo-username',
    buildUrl: (link, amount) => {
      // Venmo deep link format
      const username = link.replace('@', '');
      return `venmo://paycharge?txn=pay&recipients=${username}&amount=${amount}&note=Quote%20Payment`;
    },
  },
  paypal: {
    label: 'PayPal',
    icon: 'dollar-sign',
    placeholder: 'https://paypal.me/yourusername',
    buildUrl: (link, amount) => {
      // PayPal.me links can include amount
      const baseUrl = link.endsWith('/') ? link : `${link}/`;
      return `${baseUrl}${amount}`;
    },
  },
  cashapp: {
    label: 'Cash App',
    icon: 'dollar-sign',
    placeholder: '$yourcashtag',
    buildUrl: (link, amount) => {
      // Cash App link format
      const cashtag = link.replace('$', '');
      return `https://cash.app/$${cashtag}/${amount}`;
    },
  },
  zelle: {
    label: 'Zelle',
    icon: 'send',
    placeholder: 'Not needed for Zelle',
    detailsLabel: 'Zelle Email or Phone',
    detailsPlaceholder: 'email@example.com or (555) 123-4567',
    buildUrl: () => null, // Zelle doesn't have deep links
    instructions: (details, amount) =>
      `Send $${amount.toFixed(2)} to ${details} via Zelle`,
  },
  square: {
    label: 'Square',
    icon: 'square',
    placeholder: 'https://square.link/xxx',
    buildUrl: (link) => link, // Square links work as-is
  },
  none: {
    label: 'No Online Payment',
    icon: 'x',
    placeholder: '',
    buildUrl: () => null,
  },
};

export function getPaymentUrl(
  settings: UserSettings,
  amount: number
): string | null {
  const config = PAYMENT_METHODS[settings.payment_method];
  if (!config || !settings.payment_link) return null;

  return config.buildUrl(settings.payment_link, amount, settings.payment_details);
}

export function getPaymentInstructions(
  settings: UserSettings,
  amount: number
): string | null {
  const config = PAYMENT_METHODS[settings.payment_method];
  if (!config?.instructions || !settings.payment_details) return null;

  return config.instructions(settings.payment_details, amount);
}

export function getPaymentButtonLabel(method: PaymentMethod): string {
  switch (method) {
    case 'stripe':
      return 'Pay with Card';
    case 'venmo':
      return 'Pay with Venmo';
    case 'paypal':
      return 'Pay with PayPal';
    case 'cashapp':
      return 'Pay with Cash App';
    case 'zelle':
      return 'Pay with Zelle';
    case 'square':
      return 'Pay with Square';
    default:
      return 'Pay';
  }
}
