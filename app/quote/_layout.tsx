import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function QuoteLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
        },
        headerTintColor: isDark ? '#FFFFFF' : '#111827',
        contentStyle: {
          backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
        },
      }}
    />
  );
}
