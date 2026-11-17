import { useContext, useLayoutEffect, useRef } from 'react';
import { UNSAFE_NavigationContext, useLocation } from 'react-router-dom';
import { useActivityId } from '@/os/ActivityContext';
import type { Contact } from '../types';
import { contactSourceIsCurrent } from '../state';

/** Detail actions belong to the exact source, top Activity and live history entry. */
export function useContactDetailOwner(contact: Contact | undefined, options?: ({ modal: 'sms' | 'qr' } | { menu: 'more' }) & { allowMissing?: boolean }) {
  const activityId = useActivityId(), location = useLocation();
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const liveKey = useRef(location.key), mounted = useRef(false);
  liveKey.current = location.key;
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  return () => {
    const os = window.__OS__?.getState();
    const currentKey = (navigator as { location?: typeof location }).location?.key ?? liveKey.current;
    const params = new URLSearchParams(location.search);
    return (contact ? contactSourceIsCurrent(contact) : options?.allowMissing === true)
      && mounted.current && (options && 'menu' in options
        ? params.get('menu') === options.menu && !params.has('modal')
        : !params.has('menu') && (options ? params.get('modal') === options.modal : !params.has('modal')))
      && currentKey === location.key && liveKey.current === location.key
      && !!activityId && !os?.isLauncherVisible && !os?.isRecentsVisible
      && os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1)?.activityId === activityId;
  };
}
