import type { BilibiliUser } from '../types';
type Profile = Pick<BilibiliUser, 'uid' | 'name' | 'sign'>;
export type ProfileEditSource = { uid?: string; field: 'name' | 'sign'; value: string };
export function profileEditSource(user: Profile, field: ProfileEditSource['field']): ProfileEditSource {
  return { uid: user.uid, field, value: user[field] ?? '' };
}
export function profileEditIsCurrent(user: Profile, source: ProfileEditSource): boolean {
  return user.uid === source.uid && (user[source.field] ?? '') === source.value;
}
export function profileEditPatch(user: Profile, source: ProfileEditSource, input: string): Pick<Partial<Profile>, 'name' | 'sign'> | null {
  if (!profileEditIsCurrent(user, source)) return null;
  const value = input.trim();
  if (value === source.value || source.field === 'name' && !value || source.field === 'sign' && input.length > 70) return null;
  return { [source.field]: value };
}
