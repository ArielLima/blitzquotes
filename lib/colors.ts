/**
 * BlitzQuotes Color Palette
 *
 * Usage: import { colors } from '@/lib/colors'
 * Then: colors.primary.blue or colors.gray[500]
 */

export const colors = {
  // ============================================
  // BRAND COLORS (from user)
  // ============================================

  primary: {
    blue: '#3A84F1',        // Buttons, links, actions
    blueLight: '#44B4F4',   // Highlights, AI mode
    blueDark: '#2563EB',    // Pressed/hover state
    blueBg: '#EBF4FF',      // Light blue background (light mode)
    blueBgDark: '#1E3A5F',  // Light blue background (dark mode)
  },

  // ============================================
  // STATUS COLORS
  // ============================================

  status: {
    // Success - Paid, Approved
    success: '#22C55E',
    successLight: '#86EFAC',
    successDark: '#16A34A',
    successBg: '#DCFCE7',
    successBgDark: '#064E3B',

    // Warning - Viewed, Warnings
    warning: '#F9C734',
    warningLight: '#FDE68A',
    warningDark: '#D97706',
    warningBg: '#FEF9C3',
    warningBgDark: '#713F12',

    // Error - Overdue, Errors
    error: '#EF4444',
    errorLight: '#FCA5A5',
    errorDark: '#DC2626',
    errorBg: '#FEE2E2',
    errorBgDark: '#7F1D1D',

    // Info - General info states
    info: '#44B4F4',
    infoBg: '#E0F2FE',
    infoBgDark: '#0C4A6E',
  },

  // ============================================
  // GRAY SCALE (derived from your dark #292F36)
  // ============================================

  gray: {
    50: '#F9FAFB',    // Lightest gray
    100: '#F3F4F6',   // Card backgrounds (light)
    200: '#E5E7EB',   // Borders, dividers (light)
    300: '#D1D5DB',   // Disabled text (light)
    400: '#9CA3AF',   // Placeholder text
    500: '#6B7280',   // Secondary text (your gray)
    600: '#4B5563',   // Icons, labels
    700: '#374151',   // Card backgrounds (dark)
    800: '#1F2937',   // Main background (dark)
    900: '#292F36',   // Your dark text color
    950: '#111827',   // Darkest - can use for extra contrast
  },

  // ============================================
  // SEMANTIC COLORS (what things mean)
  // ============================================

  text: {
    // Light mode
    primary: '#292F36',       // Main text
    secondary: '#6B7280',     // Secondary text
    placeholder: '#9CA3AF',   // Placeholder/hint text
    disabled: '#D1D5DB',      // Disabled text
    inverse: '#FFFFFF',       // Text on dark backgrounds

    // Dark mode
    primaryDark: '#FFFFFF',
    secondaryDark: '#9CA3AF',
    placeholderDark: '#6B7280',
    disabledDark: '#4B5563',
  },

  background: {
    // Light mode
    primary: '#F9FAFB',       // Main background (neutral gray)
    secondary: '#FFFFFF',     // Cards, elevated surfaces
    tertiary: '#F3F4F6',      // Input backgrounds, subtle sections

    // Dark mode
    primaryDark: '#111827',   // Main background
    secondaryDark: '#1F2937', // Cards, elevated surfaces
    tertiaryDark: '#374151',  // Input backgrounds, subtle sections
  },

  border: {
    light: '#E5E7EB',         // Default border (light mode)
    medium: '#D1D5DB',        // Emphasized border (light mode)
    dark: '#374151',          // Default border (dark mode)
    darkMedium: '#4B5563',    // Emphasized border (dark mode)
    focus: '#3A84F1',         // Focus ring color
  },

  // ============================================
  // SPECIAL COLORS
  // ============================================

  special: {
    purple: '#8B5CF6',        // Used for "Copy Link", accents
    purpleLight: '#A78BFA',
    purpleBg: '#EDE9FE',

    pink: '#EC4899',          // Accent, if needed

    overlay: 'rgba(0, 0, 0, 0.5)',  // Modal overlays
    overlayDark: 'rgba(0, 0, 0, 0.7)',
  },

  // ============================================
  // QUOTE STATUS COLORS (semantic mapping)
  // ============================================

  quoteStatus: {
    draft: '#6B7280',         // Gray
    sent: '#3A84F1',          // Blue
    viewed: '#F9C734',        // Yellow/Gold
    approved: '#22C55E',      // Green
    invoiced: '#8B5CF6',      // Purple
    paid: '#22C55E',          // Green
    overdue: '#EF4444',       // Red
  },
} as const;

// ============================================
// HELPER: Get colors based on color scheme
// ============================================

export const getThemedColor = (isDark: boolean) => ({
  // Backgrounds
  bg: isDark ? colors.background.primaryDark : colors.background.primary,
  bgCard: isDark ? colors.background.secondaryDark : colors.background.secondary,
  bgInput: isDark ? colors.background.tertiaryDark : colors.background.tertiary,

  // Text
  text: isDark ? colors.text.primaryDark : colors.text.primary,
  textSecondary: isDark ? colors.text.secondaryDark : colors.text.secondary,
  textPlaceholder: isDark ? colors.text.placeholderDark : colors.text.placeholder,

  // Borders
  border: isDark ? colors.border.dark : colors.border.light,
  borderMedium: isDark ? colors.border.darkMedium : colors.border.medium,
});

export type Colors = typeof colors;
