import type { JsonBodyType } from 'msw';

export type Role = 'viewer' | 'editor' | 'admin';

const PERMISSIONS: Record<Role, string[]> = {
  viewer: ['dashboard:read'],
  editor: ['dashboard:read', 'dashboard:write'],
  admin: ['dashboard:read', 'dashboard:write', 'billing:manage', 'members:manage'],
};

/** Deterministic by design — a demo that changes on every reload cannot be shared. */
export const createUser = ({
  id = 'u_1024',
  name = 'Ria Ang',
  role = 'viewer' as Role,
  seatsUsed = 3,
}: Partial<{ id: string; name: string; role: Role; seatsUsed: number }> = {}): JsonBodyType => ({
  id,
  name,
  role,
  permissions: PERMISSIONS[role],
  organization: { id: 'org_7', name: 'KakaoCloud', seatsUsed, seatLimit: 10 },
});

export const createErrorBody = (code: string, message: string, hint?: string): JsonBodyType => ({
  error: { code, message, ...(hint ? { hint } : {}) },
});

/** A user in the Petstore spec's `User` shape, for the live-API row. */
export const createPetstoreUser = ({ userStatus }: { userStatus: number }) => ({
  id: 1001,
  username: 'user1',
  firstName: 'Mina',
  lastName: 'Kim',
  email: 'mina.kim@example.test',
  phone: '010-1234-5678',
  userStatus,
});
