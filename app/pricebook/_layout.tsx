import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { colors } from '@/lib/colors';

export default function PricebookLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary,
        },
        headerTintColor: isDark ? colors.text.primaryDark : colors.gray[950],
        contentStyle: {
          backgroundColor: isDark ? colors.background.secondaryDark : colors.background.tertiary,
        },
      }}
    />
  );
}
