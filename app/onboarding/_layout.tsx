import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { colors } from '@/lib/colors';

export default function OnboardingLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: isDark ? colors.background.secondaryDark : colors.background.tertiary,
        },
      }}
    />
  );
}
