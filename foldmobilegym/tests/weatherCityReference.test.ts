import { describe, expect, it } from 'vitest';
import { MAJOR_CITIES } from '../apps/Weather/constants';
import defaults from '../apps/Weather/data/defaults.json';
import { strings } from '../apps/Weather/res/strings';
import { stringsEn } from '../apps/Weather/res/strings.en';

describe('Weather recorded city surfaces', () => {
  it('keeps the recorded manager/search hierarchy localized', () => {
    expect(strings.city_manager_title).toBe('管理城市');
    expect(strings.city_search_title).toBe('添加城市');
    expect(strings.city_search_recommended).toBe('推荐城市');
    expect(strings.city_manager_search_placeholder).toBe('搜索城市（中文/拼音）');
    expect(stringsEn.city_search_title).toBe('Add City');
  });

  it('builds the recorded 24-cell recommendation grid without changing saved defaults', () => {
    expect(MAJOR_CITIES).toHaveLength(23);
    expect(defaults.savedCities).toHaveLength(6);
    expect(defaults.savedCities.map(city => city.id)).toEqual([
      'beijing', 'guangzhou', 'shenzhen', 'hangzhou', 'chengdu', 'shanghai',
    ]);
  });
});
