/** Helpers for keeping device-local student data isolated between accounts. */

export interface StorageUser {
  id?: string | null;
  email?: string | null;
}

const SCOPED_KEY_PATTERN = /^ejust:([a-z0-9][a-z0-9-]*):u:([A-Za-z0-9._~%+-]+)$/;

export function storageScopeForUser(user?: StorageUser | null): string | null {
  return user?.id || user?.email || null;
}

/** Signed-in students get a namespaced key; guests keep the legacy key. */
export function scopedStorageKey(feature: string, user?: StorageUser | null): string {
  const scope = storageScopeForUser(user);
  return scope
    ? `ejust:${feature}:u:${encodeURIComponent(scope)}`
    : `ejust:${feature}`;
}

export function isScopedStorageKey(key: string): boolean {
  return SCOPED_KEY_PATTERN.test(key);
}

/** Return the unscoped key that determines how a scoped value is validated. */
export function baseStorageKey(key: string): string {
  const match = key.match(SCOPED_KEY_PATTERN);
  return match ? `ejust:${match[1]}` : key;
}
