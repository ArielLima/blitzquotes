import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import { colors } from '@/lib/colors';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={24} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary.blue,
        tabBarInactiveTintColor: colorScheme === 'dark' ? colors.text.secondaryDark : colors.text.secondary,
        tabBarStyle: {
          backgroundColor: colorScheme === 'dark' ? colors.background.secondaryDark : colors.background.secondary,
          borderTopColor: colorScheme === 'dark' ? colors.border.dark : colors.border.light,
        },
        headerStyle: {
          backgroundColor: colorScheme === 'dark' ? colors.background.secondaryDark : colors.background.secondary,
        },
        headerTintColor: colorScheme === 'dark' ? colors.text.primaryDark : colors.text.primary,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Quotes',
          tabBarIcon: ({ color }) => <TabBarIcon name="file-text-o" color={color} />,
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color }) => <TabBarIcon name="briefcase" color={color} />,
        }}
      />
      <Tabs.Screen
        name="pricebook"
        options={{
          title: 'Prices',
          tabBarIcon: ({ color }) => <TabBarIcon name="database" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabBarIcon name="cog" color={color} />,
        }}
      />
    </Tabs>
  );
}
