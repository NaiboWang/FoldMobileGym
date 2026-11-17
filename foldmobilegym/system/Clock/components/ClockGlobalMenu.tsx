import React, { useEffect, useRef } from 'react';
import { useAppStrings } from '../../../os/useAppStrings';
import { useClockGestures } from '../hooks/useClockGestures';
import { useAlarmInteractionOwner } from '../hooks/useAlarmInteractionOwner';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export function ClockGlobalMenu({ onSettingsOpen }: { onSettingsOpen: () => void }) {
  const s = useAppStrings(strings, stringsEn), { bindTap, bindBack } = useClockGestures();
  const owns = useAlarmInteractionOwner('clock-global-menu');
  const settings = bindTap('alarm.menu.settings.open'), close = bindBack();
  const first = useRef<HTMLButtonElement>(null);
  const initialOwner = useRef(owns);
  // A Clock activity can keep a declared menu mounted while another split pane
  // owns the foreground. Do not move browser focus into the hidden pane on
  // background route updates. Later rerenders must not override the user's focus.
  useEffect(() => { if (initialOwner.current()) first.current?.focus({ preventScroll: true }); }, []);
  return <div className="absolute inset-0 z-40" data-clock-menu-layer>
    <button type="button" className="absolute inset-0 w-full h-full" aria-label={s.clock_menu_close}
      {...close} onClick={event => { if (owns()) close.onClick?.(event); }} />
    <section className="clock-global-menu" role="menu" aria-label={s.toolbar_more} data-clock-global-menu
      data-scroll-container="globalMenu" data-scroll-direction="vertical">
      <button type="button" role="menuitem" disabled aria-disabled="true">
        <span>{s.clock_sleep_enable}</span><small>{s.clock_settings_unavailable}</small>
      </button>
      <button type="button" role="menuitem" ref={first} {...settings}
        onClick={event => { if (owns()) { onSettingsOpen(); settings.onClick?.(event); } }}>{s.clock_settings_title}</button>
    </section>
  </div>;
}
