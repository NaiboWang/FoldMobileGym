import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActivityContext } from '@/os/ActivityContext';
import { AppNavigatorRegistry } from '@/os/AppNavigatorRegistry';

/** Routing a borrowed Mail Activity must not target a background own task. */
export function MailActivityNavigation() {
  const { activityId } = useActivityContext();
  const navigate = useNavigate();
  useEffect(() => {
    AppNavigatorRegistry.registerActivity(activityId, {
      navigate: (path, options) => navigate(path, { replace: options?.replace ?? true }),
    });
    return () => AppNavigatorRegistry.unregisterActivity(activityId);
  }, [activityId, navigate]);
  return null;
}
