import { describe, expect, it } from 'vitest';
import { profileEditSource, profileEditIsCurrent, profileEditPatch } from '../apps/Bilibili/utils/profileEdit';
const user = { uid: 'local-user', name: 'Original name', sign: 'Original sign' };
describe('Bilibili profile editor source checks', () => {
  it('updates only the requested field and trims its supplied text', () => {
    const source = profileEditSource(user, 'name');
    expect(profileEditPatch(user, source, ' New name ')).toEqual({ name: 'New name' });
    expect(user).toEqual({ uid: 'local-user', name: 'Original name', sign: 'Original sign' });
  });
  it('rejects empty and unchanged names', () => {
    const source = profileEditSource(user, 'name');
    expect(profileEditPatch(user, source, '   ')).toBeNull();
    expect(profileEditPatch(user, source, user.name)).toBeNull();
  });
  it('supports clearing an existing signature but not rewriting an already empty one', () => {
    expect(profileEditPatch(user, profileEditSource(user, 'sign'), ' ')).toEqual({ sign: '' });
    const legacy = { ...user, sign: undefined };
    expect(profileEditPatch(legacy, profileEditSource(legacy, 'sign'), '')).toBeNull();
  });
  it.each(['name', 'sign'] as const)('rejects a replaced %s value while preserving a local candidate', field => {
    const source = profileEditSource(user, field);
    const changed = { ...user, [field]: 'Newer source value' };
    expect(profileEditIsCurrent(changed, source)).toBe(false);
    expect(profileEditPatch(changed, source, 'Local candidate')).toBeNull();
  });
  it('rejects a different supplied user identity even if display values match', () => {
    const source = profileEditSource(user, 'name');
    expect(profileEditPatch({ ...user, uid: 'other-user' }, source, 'Local candidate')).toBeNull();
  });
  it('does not reject unrelated fields or invent a missing identity', () => {
    const legacy = { name: user.name, sign: user.sign };
    const source = profileEditSource(legacy, 'name');
    expect(source.uid).toBeUndefined();
    expect(profileEditPatch({ ...legacy, sign: 'Unrelated update' }, source, 'New name')).toEqual({ name: 'New name' });
  });
  it('retains the existing signature length limit', () => {
    const source = profileEditSource(user, 'sign');
    expect(profileEditPatch(user, source, 'x'.repeat(71))).toBeNull();
    expect(profileEditPatch(user, source, 'x'.repeat(70))).toEqual({ sign: 'x'.repeat(70) });
  });
});
