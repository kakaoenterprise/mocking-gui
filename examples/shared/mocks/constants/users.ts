import type { UserRole } from '../types';

export const FEATURES_BY_ROLE: Record<UserRole, string[]> = {
  Admin: ['Dashboard', 'Settings', 'Billing', 'Audit Log'],
  User: ['Dashboard', 'Settings'],
  Guest: [],
};

/** Usernames the dynamic handlers treat specially, so an example can link to them. */
export const SPECIAL_USERNAMES = {
  admin: 'ria-admin',
  guest: 'ria-guest',
  missing: 'nobody',
} as const;
