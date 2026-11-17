import type { ServiceIconName } from './res/icons';
import type { strings } from './res/strings';

type ServiceDefinition = { id: string; label: keyof typeof strings; icon: ServiceIconName; tone: string };
/** Structural main-App catalog observed in the reference; not fabricated service records. */
export const MAIN_SERVICES = [
  { id: 'delivery', label: 'main_delivery', icon: 'IcDelivery', tone: 'yellow' },
  { id: 'deals', label: 'main_deals', icon: 'IcDeals', tone: 'yellow' },
  { id: 'travel', label: 'main_travel', icon: 'IcTravel', tone: 'blue' },
  { id: 'flash', label: 'main_flash', icon: 'IcFlash', tone: 'yellow' },
  { id: 'health', label: 'main_health', icon: 'IcHealth', tone: 'yellow' },
  { id: 'groceries', label: 'main_groceries', icon: 'IcGroceries', tone: 'green' },
  { id: 'dining', label: 'main_dining', icon: 'IcDining', tone: 'orange' },
  { id: 'fun', label: 'main_fun', icon: 'IcFun', tone: 'purple' },
  { id: 'pinhaofan', label: 'main_pinhaofan', icon: 'IcPinhaofan', tone: 'pink' },
  { id: 'movies', label: 'main_movies', icon: 'IcMovies', tone: 'orange' },
  { id: 'fruit', label: 'main_fruit', icon: 'IcFruit', tone: 'green' },
  { id: 'local', label: 'main_local', icon: 'IcLocal', tone: 'blue' },
  { id: 'massage', label: 'main_massage', icon: 'IcMassage', tone: 'pink' },
  { id: 'free-fruit', label: 'main_free_fruit', icon: 'IcFreeFruit', tone: 'green' },
  { id: 'more', label: 'main_more', icon: 'IcMore', tone: 'purple' },
] as const satisfies readonly ServiceDefinition[];

export function mainServiceLabel(id: string): keyof typeof strings {
  if (id === 'video') return 'main_video';
  if (id === 'assistant') return 'main_assistant';
  if (id === 'messages') return 'main_messages';
  if (id === 'scan') return 'main_scan';
  return MAIN_SERVICES.find(service => service.id === id)?.label ?? 'main_unknown_service';
}
