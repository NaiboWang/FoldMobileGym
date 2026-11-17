import { expect, it } from 'vitest';
import { resolveGoogleMapsSdkLocale } from '../apps/Map/utils/googleMapsConfig';

it.each([
  ['zh-Hans', false, 'zh-Hans'],
  ['en', false, 'zh-Hans'],
  ['zh-Hans', true, 'zh-Hans'],
  ['en', true, 'en'],
] as const)('keeps UI %s independent from offline SDK (live=%s)', (locale, live, expected) => {
  expect(resolveGoogleMapsSdkLocale(locale, live)).toBe(expected);
});
