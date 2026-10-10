import { describe, expect, it } from 'vitest';
import {
  canEditPurchases,
  canManageMembers,
  changeRoleSchema,
  hasRole,
  inviteMemberSchema,
} from './household';

describe('roles', () => {
  it('orders owner > editor > viewer', () => {
    expect(hasRole('owner', 'editor')).toBe(true);
    expect(hasRole('editor', 'editor')).toBe(true);
    expect(hasRole('viewer', 'editor')).toBe(false);
    expect(hasRole('editor', 'owner')).toBe(false);
  });

  it('lets owners and editors change purchases, only owners manage members', () => {
    expect([
      canEditPurchases('owner'),
      canEditPurchases('editor'),
      canEditPurchases('viewer'),
    ]).toEqual([true, true, false]);
    expect([canManageMembers('owner'), canManageMembers('editor')]).toEqual([true, false]);
  });
});

describe('inviteMemberSchema', () => {
  it('normalizes the email', () => {
    expect(inviteMemberSchema.parse({ email: '  Vo@Example.COM ', role: 'editor' })).toEqual({
      email: 'vo@example.com',
      role: 'editor',
    });
  });

  it.each([
    [{ email: 'not-an-email', role: 'editor' }, 'email'],
    [{ email: 'vo@example.com', role: 'owner' }, 'role'],
    [{ email: 'vo@example.com' }, 'role'],
    [{ email: 'vo@example.com', role: 'viewer', householdId: 'x' }, ''],
  ])('rejects %j', (input, path) => {
    const result = inviteMemberSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join('.'))).toContain(path);
  });
});

describe('changeRoleSchema', () => {
  it('only allows editor or viewer', () => {
    expect(changeRoleSchema.safeParse({ role: 'viewer' }).success).toBe(true);
    expect(changeRoleSchema.safeParse({ role: 'owner' }).success).toBe(false);
  });
});
