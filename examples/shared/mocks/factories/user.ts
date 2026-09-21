import { FEATURES_BY_ROLE } from '../constants/users';

import type { User, UserRole } from '../types';

/**
 * Builds a user, deriving `features` from the role unless explicitly overridden.
 * Prefer this over literal objects so every handler stays consistent as the shape grows.
 */
export const createUser = (overrides: Partial<User> & { name: string }): User => {
  const role: UserRole = overrides.role ?? 'User';

  return {
    id: overrides.id ?? `user_${overrides.name.toLowerCase().replace(/\s+/g, '-')}`,
    name: overrides.name,
    role,
    features: overrides.features ?? FEATURES_BY_ROLE[role],
  };
};

export const createUserList = (count: number): User[] =>
  Array.from({ length: count }, (_, index) =>
    createUser({
      name: `Member ${index + 1}`,
      role: index === 0 ? 'Admin' : 'User',
    }),
  );
