// Web version of notifications.ts — browsers can't schedule local notifications,
// so these are no-ops. Metro picks this file automatically on web.

export async function requestNotificationPermissions(): Promise<boolean> {
  return false;
}

export async function scheduleNotification(
  _id: string,
  _title: string,
  _body: string,
  _triggerDate: Date
): Promise<void> {}

export async function cancelNotification(_id: string): Promise<void> {}

export async function getNotificationsEnabled(): Promise<boolean> {
  return false;
}

export async function setNotificationsEnabled(_enabled: boolean): Promise<void> {}
