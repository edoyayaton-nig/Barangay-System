// Centralized Global Reactive Data Synchronization Bus for Barangay Health Modules
// Guarantees immediate cross-tab AND intra-window/same-tab reactivity and cache invalidation.

const CHANNEL_NAME = 'barangay_health_sync';
const LOCAL_EVENT_NAME = 'barangay_health_sync_event';
const SMS_SENT_STORAGE_KEY = 'brgy_health_sms_sent_registry_v1';

export interface HealthSyncEventDetail {
  type: string;
  source?: string;
  payload?: any;
  timestamp: number;
}

// ── Persistent Sent Reminder Registry ────────────────────────────────────────
export function getSentReminderRegistry(): Set<string> {
  try {
    const raw = localStorage.getItem(SMS_SENT_STORAGE_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    return new Set<string>(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
}

export function saveSentReminderIds(ids: Array<string | number>): void {
  try {
    const current = getSentReminderRegistry();
    ids.forEach(id => current.add(String(id)));
    localStorage.setItem(SMS_SENT_STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch (err) {
    console.warn('Failed to save sent reminder IDs:', err);
  }
}

export function isReminderMarkedSent(rawId: string | number, category?: 'maternal' | 'immunization'): boolean {
  const current = getSentReminderRegistry();
  const strId = String(rawId);
  if (current.has(strId)) return true;
  if (category === 'maternal') {
    if (current.has(`mat-${strId}`) || current.has(`mat-up-${strId}`)) return true;
  }
  if (category === 'immunization') {
    if (current.has(`imm-${strId}`) || current.has(`imm-up-${strId}`)) return true;
  }
  return false;
}

// ── Centralized Sync Bus ──────────────────────────────────────────────────────
export function notifyHealthDataChanged(type = 'HEALTH_DATA_MUTATION', payload?: any): void {
  const timestamp = Date.now();
  const detail: HealthSyncEventDetail = {
    type,
    source: 'health_bus',
    payload,
    timestamp
  };

  // 1. Same-window immediate dispatch (CustomEvent)
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(LOCAL_EVENT_NAME, { detail }));
    } catch (e) {
      console.warn('[HealthSync] Window event dispatch failed:', e);
    }
  }

  // 2. Cross-tab BroadcastChannel dispatch
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage({
        ...detail
      });
      channel.close();
    } catch (e) {
      console.warn('[HealthSync] BroadcastChannel postMessage failed:', e);
    }
  }
}

export function subscribeHealthDataSync(onSync: (detail?: HealthSyncEventDetail) => void): () => void {
  let isCleanedUp = false;

  // 1. Same-window listener
  const localHandler = (e: Event) => {
    if (isCleanedUp) return;
    const customEvt = e as CustomEvent<HealthSyncEventDetail>;
    onSync(customEvt.detail);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(LOCAL_EVENT_NAME, localHandler);
  }

  // 2. Cross-tab BroadcastChannel listener
  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (isCleanedUp) return;
        if (event.data?.type === 'HEALTH_DATA_SYNC') {
          onSync(event.data);
        }
      };
    } catch {}
  }

  // Cleanup subscriber
  return () => {
    isCleanedUp = true;
    if (typeof window !== 'undefined') {
      window.removeEventListener(LOCAL_EVENT_NAME, localHandler);
    }
    if (channel) {
      try {
        channel.close();
      } catch {}
    }
  };
}
