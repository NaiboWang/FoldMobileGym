import type { strings } from './strings';
export const stringsEn: Record<keyof typeof strings, string> = {
  today: 'Featured', apps: 'Apps', search: 'Search', back: 'Back', open: 'Open', installed: 'Installed',
  headline: 'Make every day easier', subtitle: 'Discover useful apps on this device',
  featured: 'Editor’s picks', daily: 'Everyday apps', system: 'System tools', all: 'All apps',
  searchPlaceholder: 'Apps, names or keywords', empty: 'No apps found',
  emptyHint: 'Try another name or keyword', searchHint: 'Search apps on this device',
  about: 'About this app', version: 'Version', compatibility: 'Compatibility', compatible: 'Folded and unfolded layouts',
  dailyDescription: 'Explore everyday interactions with this app on the simulated device.',
  systemDescription: 'A system utility for everyday operations on the simulated device.',
  notice: 'A research simulation showing apps in this environment. No real store or download service is connected.',
  unavailable: 'This app is not in the current catalog', available: 'Available on this device', details: 'View details',
};
