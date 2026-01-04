import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { router } from 'expo-router';

// Configure notification handler (what happens when notification arrives while app is open)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and save token to Supabase
 * Call this after user is authenticated
 */
export async function registerForPushNotifications(userId: string): Promise<string | null> {
  // Only works on physical devices
  if (!Device.isDevice) {
    console.log('Push notifications only work on physical devices');
    return null;
  }

  // Check/request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  // Get Expo push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    // Save token to Supabase user_settings
    const { error } = await supabase
      .from('user_settings')
      .update({ push_token: token.data })
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to save push token:', error);
    } else {
      console.log('Push token saved:', token.data.slice(0, 20) + '...');
    }

    // Android requires notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3B82F6',
      });
    }

    return token.data;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}

/**
 * Set up notification response listener (handles taps)
 * Returns cleanup function
 */
export function setupNotificationListeners(): () => void {
  // Handle notification taps (when user taps notification)
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data;

      // Navigate to quote detail if quoteId is present
      if (data?.quoteId) {
        router.push(`/quote/${data.quoteId}`);
      }
    }
  );

  // Handle notifications received while app is in foreground (optional logging)
  const notificationSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log('Notification received in foreground:', notification.request.content.title);
    }
  );

  // Return cleanup function
  return () => {
    responseSubscription.remove();
    notificationSubscription.remove();
  };
}

/**
 * Clear push token when user signs out
 */
export async function clearPushToken(userId: string): Promise<void> {
  try {
    await supabase
      .from('user_settings')
      .update({ push_token: null })
      .eq('user_id', userId);
  } catch (error) {
    console.error('Failed to clear push token:', error);
  }
}
