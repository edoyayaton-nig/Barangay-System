/**
 * Safe local storage manager for 'barangay_user'
 * Prevents QuotaExceededError by stripping unnecessary heavy base64 assets
 * and gracefully falling back to sessionStorage or minimal representation.
 */

export function sanitizeUserForStorage(user: any): any {
  if (!user || typeof user !== 'object') return user;
  const clean = { ...user };

  // Never store heavy base64 strings in localStorage
  if (clean.submitted_id && clean.submitted_id.length > 500) {
    clean.submitted_id = 'submitted';
  }
  if (clean.profile_photo && clean.profile_photo.length > 100000) {
    delete clean.profile_photo;
  }
  if (clean.avatar && clean.avatar.length > 100000) {
    delete clean.avatar;
  }

  return clean;
}

export function saveStoredUser(user: any): boolean {
  if (!user) {
    try {
      localStorage.removeItem('barangay_user');
      sessionStorage.removeItem('barangay_user');
    } catch {}
    return true;
  }

  const sanitized = sanitizeUserForStorage(user);
  const jsonStr = JSON.stringify(sanitized);

  try {
    localStorage.setItem('barangay_user', jsonStr);
    return true;
  } catch (err: any) {
    console.warn('[Storage] Quota exceeded on localStorage. Attempting cleanup...', err);
    
    // Clear out non-vital keys in localStorage if it is full
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k !== 'barangay_user' && (k.includes('cache') || k.includes('image') || k.includes('doc') || k.includes('temp') || k.includes('draft'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      
      localStorage.setItem('barangay_user', jsonStr);
      return true;
    } catch {
      // If still failing, store minimal user info
      try {
        const minimal = {
          id: sanitized.id,
          name: sanitized.name,
          first_name: sanitized.first_name,
          last_name: sanitized.last_name,
          email: sanitized.email,
          role: sanitized.role,
          barangay: sanitized.barangay,
          status: sanitized.status,
          verification_status: sanitized.verification_status,
          phone: sanitized.phone,
          address: sanitized.address,
          purok: sanitized.purok,
          city: sanitized.city
        };
        localStorage.setItem('barangay_user', JSON.stringify(minimal));
        return true;
      } catch {
        // Ultimate fallback: sessionStorage
        try {
          sessionStorage.setItem('barangay_user', jsonStr);
          return true;
        } catch (e4) {
          console.error('[Storage] Failed to store user even in sessionStorage:', e4);
          return false;
        }
      }
    }
  }
}

export function getStoredUser(): any | null {
  try {
    const raw = localStorage.getItem('barangay_user') || sessionStorage.getItem('barangay_user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearStoredUser(): void {
  try {
    localStorage.removeItem('barangay_user');
    sessionStorage.removeItem('barangay_user');
  } catch {}
}
