// Persistent Notification Store for Barangay Pianing Smart Governance System
// Ensures notifications are permanently stored and never auto-deleted upon viewing or task completion.

export interface PersistentNotification {
  id: string;
  type: 'account' | 'document' | 'health' | 'system' | 'verification';
  title: string;
  message: string;
  ref_code?: string;
  status_badge?: string;
  badge_color?: 'red' | 'amber' | 'blue' | 'indigo' | 'emerald' | 'slate';
  timestamp: string;
  is_read: boolean;
  action_type?: 'resubmit_id' | 'view_document' | 'view_schedule';
}

const getStorageKey = (email?: string): string => {
  const clean = (email || 'default').toLowerCase().trim();
  return `brgy_notifications_history_${clean}`;
};

export const notificationStore = {
  getNotifications(email?: string): PersistentNotification[] {
    if (!email) return [];
    try {
      const raw = localStorage.getItem(getStorageKey(email));
      if (!raw) return [];
      const list: PersistentNotification[] = JSON.parse(raw);
      // Sort newest first
      return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch {
      return [];
    }
  },

  addNotification(email: string, notif: Omit<PersistentNotification, 'id' | 'timestamp' | 'is_read'> & { id?: string; timestamp?: string; is_read?: boolean }): PersistentNotification {
    if (!email) return notif as any;
    const key = getStorageKey(email);
    const existing = this.getNotifications(email);

    // If an identical notification with the same ref_code and type already exists, don't duplicate
    const notifId = notif.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const existingIdx = existing.findIndex(n => n.id === notifId || (notif.ref_code && n.ref_code === notif.ref_code && n.title === notif.title));

    const item: PersistentNotification = {
      id: notifId,
      type: notif.type,
      title: notif.title,
      message: notif.message,
      ref_code: notif.ref_code,
      status_badge: notif.status_badge,
      badge_color: notif.badge_color || 'indigo',
      timestamp: notif.timestamp || new Date().toISOString(),
      is_read: notif.is_read ?? false,
      action_type: notif.action_type
    };

    let updated: PersistentNotification[];
    if (existingIdx >= 0) {
      // Preserve read status unless status has meaningfully changed
      const old = existing[existingIdx];
      updated = [...existing];
      updated[existingIdx] = {
        ...old,
        ...item,
        is_read: old.is_read // preserve read status
      };
    } else {
      updated = [item, ...existing];
    }

    try {
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save notification to store:', e);
    }

    return item;
  },

  markAsRead(email: string, notifId: string): void {
    if (!email) return;
    const key = getStorageKey(email);
    const existing = this.getNotifications(email);
    const updated = existing.map(n => n.id === notifId ? { ...n, is_read: true } : n);
    try {
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to update notification read status:', e);
    }
  },

  markAllAsRead(email: string): void {
    if (!email) return;
    const key = getStorageKey(email);
    const existing = this.getNotifications(email);
    const updated = existing.map(n => ({ ...n, is_read: true }));
    try {
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to mark all notifications as read:', e);
    }
  },

  getUnreadCount(email?: string): number {
    if (!email) return 0;
    const notifs = this.getNotifications(email);
    return notifs.filter(n => !n.is_read).length;
  }
};
