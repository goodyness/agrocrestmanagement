// Browser Push Notification utilities

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!("Notification" in window)) {
    console.log("This browser does not support notifications");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
};

export const showNotification = (title: string, options?: NotificationOptions) => {
  if (Notification.permission === "granted") {
    new Notification(title, {
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      ...options,
    });
  }
};

export const showLowStockAlert = (feedName: string, currentStock: number, threshold: number, unit: string) => {
  showNotification("⚠️ Low Stock Alert!", {
    body: `${feedName} is running low!\nCurrent: ${currentStock} ${unit}\nThreshold: ${threshold} ${unit}`,
    tag: `low-stock-${feedName}`,
    requireInteraction: true,
  });
};

export const showCleaningReminder = (daysUntil: number, tasks: string[]) => {
  const title = daysUntil === 0 ? "🧹 Cleaning Day Today!" : "🧹 Cleaning Reminder";
  const body = daysUntil === 0 
    ? `Today is cleaning day!\nTasks: ${tasks.join(", ")}`
    : `Cleaning scheduled in ${daysUntil} day(s).\nTasks: ${tasks.join(", ")}`;
  
  showNotification(title, {
    body,
    tag: "cleaning-reminder",
    requireInteraction: true,
  });
};
