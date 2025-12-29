import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function OnboardingLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
        },
      }}
    />
  );
}
