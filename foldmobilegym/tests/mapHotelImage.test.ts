import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
describe('Map hotel image error contract',()=>{
 it('retains original sources and delegates both cards to error-aware image',()=>{
  const source=readFileSync(new URL('../apps/Map/components/explore/ExplorePulseSheet.tsx',import.meta.url),'utf8');
  expect(source.match(/<ExploreHotelImage/g)).toHaveLength(2);
  expect(source.match(/photo-1542314831-068cd1dbfeeb/g)).toHaveLength(2);
 });
 it('uses localized missing-media state without retrying a failed source',()=>{
  const source=readFileSync(new URL('../apps/Map/components/explore/ExploreHotelImage.tsx',import.meta.url),'utf8');
  expect(source).toContain('failedSource === src');
  expect(source).toContain('onError={() => setFailedSource(src)}');
  expect(source).toContain('aria-label={s.place_no_photo}');
  expect(source).toContain('alt={s.explore_accommodation}');
 });
});
