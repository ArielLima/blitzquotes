import React from 'react';
import { StyleSheet, View, Text, useColorScheme } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

export default function QuoteDetailScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <>
      <Stack.Screen options={{ title: 'Quote Details' }} />
      <View style={[styles.container, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
        <Text style={[styles.text, { color: isDark ? '#FFFFFF' : '#111827' }]}>
          Quote {id} - Coming Soon
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 18,
  },
});
