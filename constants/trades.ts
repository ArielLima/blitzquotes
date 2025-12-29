import type { Trade } from '../types';

interface TradeConfig {
  label: string;
  description: string;
  icon: string;
  color: string;
}

export const TRADES: Record<Trade, TradeConfig> = {
  plumbing: {
    label: 'Plumbing',
    description: 'Water heaters, pipes, fixtures, drains',
    icon: 'droplet',
    color: '#3B82F6', // blue
  },
  hvac: {
    label: 'HVAC',
    description: 'Heating, cooling, ventilation',
    icon: 'wind',
    color: '#10B981', // green
  },
  electrical: {
    label: 'Electrical',
    description: 'Wiring, panels, outlets, fixtures',
    icon: 'zap',
    color: '#F59E0B', // amber
  },
  general: {
    label: 'General Contractor',
    description: 'Home repair and improvement',
    icon: 'tool',
    color: '#6B7280', // gray
  },
};

export const TRADE_LIST = Object.entries(TRADES).map(([key, config]) => ({
  value: key as Trade,
  ...config,
}));

export const CATEGORIES = [
  { value: 'materials', label: 'Materials', icon: 'package' },
  { value: 'labor', label: 'Labor', icon: 'clock' },
  { value: 'equipment', label: 'Equipment', icon: 'tool' },
  { value: 'fees', label: 'Fees', icon: 'file-text' },
];

export const UNITS = [
  { value: 'each', label: 'Each' },
  { value: 'hour', label: 'Hour' },
  { value: 'foot', label: 'Foot' },
  { value: 'sqft', label: 'Sq Ft' },
  { value: 'job', label: 'Per Job' },
];
