import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const ENABLED_KEY = "notificationsEnabled";

// Show notification even when app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "OnTrack Reminders",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#6C63FF",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleNotification(
  id: string,
  title: string,
  body: string,
  triggerDate: Date
): Promise<void> {
  // Skip if the date is in the past, or the user turned reminders off in Settings
  if (triggerDate <= new Date()) return;
  if (!(await getNotificationsEnabled())) return;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title,
        body,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
  } catch {
    // Silently fail if scheduling fails (e.g. permissions not granted)
  }
}

export async function cancelNotification(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Ignore errors
  }
}

export async function getNotificationsEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(ENABLED_KEY)) !== "false";
}

// Turning off cancels everything already scheduled; turning back on is
// followed by rescheduleAllNotifications() (utils/itemNotifications.ts).
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, enabled ? "true" : "false");
  if (!enabled) {
    try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch {}
  }
}
