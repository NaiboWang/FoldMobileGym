import { useNavigate } from 'react-router-dom';

export type FoodInfoTab = 'history' | 'alternatives' | 'scan' | 'overview' | 'search';

export const FOOD_INFO_TAB_PATHS: Record<FoodInfoTab, string> = {
  history: '/',
  alternatives: '/alternatives',
  scan: '/scan',
  overview: '/overview',
  search: '/search',
};

export function useFoodInfoNavigation() {
  const navigate = useNavigate();
  return {
    switchTab: (tab: FoodInfoTab) => navigate(FOOD_INFO_TAB_PATHS[tab], { replace: true }),
  };
}
