import { strings } from './res/strings';
import type { WorldCity } from './types';
import citiesData from './data/cities.json';

export const CLOCK_CONSTANTS = {
  alarmSoundLabel: strings.alarm_default_sound,
  cities: citiesData as WorldCity[],
};

// Semantic lookup only: city records remain replaceable world data.
export const CITY_LABEL_KEYS = {
  abidjan: { name: 'city_abidjan', country: 'country_ivory_coast', initialZh: 'A' },
  adelaide: { name: 'city_adelaide', country: 'country_australia', initialZh: 'A' },
  albuquerque: { name: 'city_albuquerque', country: 'country_united_states', initialZh: 'A' },
  algiers: { name: 'city_algiers', country: 'country_algeria', initialZh: 'A' },
  accra: { name: 'city_accra', country: 'country_ghana', initialZh: 'A' },
  aktau: { name: 'city_aktau', country: 'country_kazakhstan', initialZh: 'A' },
  almaty: { name: 'city_almaty', country: 'country_kazakhstan', initialZh: 'A' },
  amsterdam: { name: 'city_amsterdam', country: 'country_netherlands', initialZh: 'A' },
  london: { name: 'city_london', country: 'country_united_kingdom', initialZh: 'L' },
  newyork: { name: 'city_newyork', country: 'country_united_states', initialZh: 'N' },
  beijing: { name: 'city_beijing', country: 'country_china', initialZh: 'B' },
  tokyo: { name: 'city_tokyo', country: 'country_japan', initialZh: 'D' },
  losangeles: { name: 'city_losangeles', country: 'country_united_states', initialZh: 'L' },
  paris: { name: 'city_paris', country: 'country_france', initialZh: 'B' },
  sydney: { name: 'city_sydney', country: 'country_australia', initialZh: 'X' },
} as const;
