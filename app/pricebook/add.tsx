import React from 'react';
import { StyleSheet, View, Text, useColorScheme } from 'react-native';
import { Stack } from 'expo-router';

export default function AddPricebookItemScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <>
      <Stack.Screen options={{ title: 'Add Item' }} />
      <View style={[styles.container, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
        <Text style={[styles.text, { color: isDark ? '#FFFFFF' : '#111827' }]}>
          Add Pricebook Item - Coming Soon
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
