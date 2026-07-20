import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface UserProfile {
  display_name?: string | null;
  full_name?: string | null;
  email?: string | null;
}

/**
 * Resolves the display name for a user with the following priority:
 * 1. display_name (custom user-set name)
 * 2. full_name (from DUPR integration)
 * 3. email prefix (part before @)
 * 4. fallback to 'Player'
 */
export function getDisplayName(profile: UserProfile | null | undefined, fallback: string = 'Player'): string {
  if (!profile) return fallback;

  // Priority 1: Custom display name
  if (profile.display_name && profile.display_name.trim()) {
    return profile.display_name.trim();
  }

  // Priority 2: DUPR full name
  if (profile.full_name && profile.full_name.trim()) {
    return profile.full_name.trim();
  }

  // Priority 3: Email prefix
  if (profile.email) {
    const emailPrefix = profile.email.split('@')[0];
    if (emailPrefix) {
      return emailPrefix;
    }
  }

  // Priority 4: Fallback
  return fallback;
}
