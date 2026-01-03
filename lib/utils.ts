import type { LineItem } from '../types';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';

  const hasPlus = phone.trim().startsWith('+');
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    // US/Canada: (555) 123-4567
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // US/Canada with country code: +1 (555) 123-4567
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    // UK: 020 1234 5678
    return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
  } else if (hasPlus && digits.length > 6) {
    // International with +: group as +XX XXX XXX XXXX
    const cc = digits.slice(0, 2);
    const rest = digits.slice(2);
    return `+${cc} ${rest.replace(/(\d{3})(?=\d)/g, '$1 ').trim()}`;
  } else if (digits.length > 6) {
    // Generic: group in threes/fours
    return digits.replace(/(\d{3})(?=\d{4,})/g, '$1 ').replace(/(\d{4})$/, ' $1').trim();
  }

  return phone;
}

export function calculateQuoteTotals(
  lineItems: LineItem[],
  taxRate: number
): { subtotal: number; tax: number; total: number } {
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

export function generateQuoteNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `Q${year}${month}-${random}`;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'draft':
      return '#6B7280'; // gray
    case 'sent':
      return '#3B82F6'; // blue
    case 'viewed':
      return '#F59E0B'; // amber
    case 'approved':
      return '#8B5CF6'; // purple
    case 'invoiced':
      return '#EC4899'; // pink
    case 'paid':
      return '#10B981'; // green
    default:
      return '#6B7280';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'sent':
      return 'Sent';
    case 'viewed':
      return 'Viewed';
    case 'approved':
      return 'Approved';
    case 'invoiced':
      return 'Invoiced';
    case 'paid':
      return 'Paid';
    default:
      return status;
  }
}

export function generateInvoiceNumber(existingCount: number): string {
  const num = existingCount + 1;
  return `INV-${num.toString().padStart(3, '0')}`;
}

export function timeAgo(date: string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10;
}
