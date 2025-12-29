import { create } from 'zustand';
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';
import type { PricebookItem, Quote, UserSettings } from '../types';

interface AppState {
  // Auth
  user: User | null;
  isLoading: boolean;
  isOnboarded: boolean;

  // Data
  settings: UserSettings | null;
  pricebook: PricebookItem[];
  quotes: Quote[];

  // Actions
  setUser: (user: User | null) => void;
  setIsLoading: (loading: boolean) => void;
  setIsOnboarded: (onboarded: boolean) => void;
  setSettings: (settings: UserSettings | null) => void;
  setPricebook: (items: PricebookItem[]) => void;
  setQuotes: (quotes: Quote[]) => void;
  addPricebookItem: (item: PricebookItem) => void;
  updatePricebookItem: (id: string, item: Partial<PricebookItem>) => void;
  deletePricebookItem: (id: string) => void;
  addQuote: (quote: Quote) => void;
  updateQuote: (id: string, quote: Partial<Quote>) => void;
  deleteQuote: (id: string) => void;

  // Data fetching
  fetchSettings: () => Promise<void>;
  fetchPricebook: () => Promise<void>;
  fetchQuotes: () => Promise<void>;
  fetchUserData: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  user: null,
  isLoading: true,
  isOnboarded: false,
  settings: null,
  pricebook: [],
  quotes: [],

  // Setters
  setUser: (user) => set({ user }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsOnboarded: (isOnboarded) => set({ isOnboarded }),
  setSettings: (settings) => set({ settings }),
  setPricebook: (pricebook) => set({ pricebook }),
  setQuotes: (quotes) => set({ quotes }),

  // Pricebook actions
  addPricebookItem: (item) =>
    set((state) => ({ pricebook: [...state.pricebook, item] })),

  updatePricebookItem: (id, updates) =>
    set((state) => ({
      pricebook: state.pricebook.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),

  deletePricebookItem: (id) =>
    set((state) => ({
      pricebook: state.pricebook.filter((item) => item.id !== id),
    })),

  // Quote actions
  addQuote: (quote) =>
    set((state) => ({ quotes: [quote, ...state.quotes] })),

  updateQuote: (id, updates) =>
    set((state) => ({
      quotes: state.quotes.map((quote) =>
        quote.id === id ? { ...quote, ...updates } : quote
      ),
    })),

  deleteQuote: (id) =>
    set((state) => ({
      quotes: state.quotes.filter((quote) => quote.id !== id),
    })),

  // Data fetching
  fetchSettings: async () => {
    const { user } = get();
    if (!user) return;

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (data) {
      set({ settings: data, isOnboarded: true });
    } else {
      set({ isOnboarded: false });
    }
  },

  fetchPricebook: async () => {
    const { user } = get();
    if (!user) return;

    const { data, error } = await supabase
      .from('pricebook_items')
      .select('*')
      .eq('user_id', user.id)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (data) {
      set({ pricebook: data });
    }
  },

  fetchQuotes: async () => {
    const { user } = get();
    if (!user) return;

    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      set({ quotes: data });
    }
  },

  fetchUserData: async () => {
    await get().fetchSettings();
    await get().fetchPricebook();
    await get().fetchQuotes();
  },

  initialize: async () => {
    set({ isLoading: true });

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        set({ user: session.user });
        await get().fetchUserData();
      }
    } catch (error) {
      console.error('Failed to initialize:', error);
    } finally {
      set({ isLoading: false });
    }
  },
}));
