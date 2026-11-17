import React, { useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPath, UNSAFE_NavigationContext, useLocation, type Location } from 'react-router-dom';
import { PlayerPage } from '../pages/PlayerPage';
import { SaveLocationSheet } from './LikedToast';
import { QueueSheet } from './QueueToast';
import { normalizePlayerSource, parallelSourceTarget, PLAYER_PARALLEL_MIN_WIDTH } from '../utils/playerWorkspace';
import '../player-reference.css';

/** One App router and store, not a second OS Task or a remounted player per posture. */
export function ReferencePlayerWorkspace({ renderSource }: { renderSource: (location: Location) => React.ReactNode }) {
  const location = useLocation();
  const navigation = useContext(UNSAFE_NavigationContext);
  const playerOpen = location.pathname === '/player';
  const parallel = playerOpen && new URLSearchParams(location.search).get('layout') === 'parallel';
  const source = playerOpen ? normalizePlayerSource(new URLSearchParams(location.search).get('source')) : location.pathname + location.search;
  const sourceUrl = new URL(source, 'http://spotify.local');
  const sourceLocation: Location = playerOpen ? {
    pathname: sourceUrl.pathname, search: sourceUrl.search, hash: '', state: null, key: source,
  } : location;
  const root = useRef<HTMLDivElement>(null);
  const sourcePane = useRef<HTMLDivElement>(null);
  const playerPane = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const update = () => setWide(element.clientWidth >= PLAYER_PARALLEL_MIN_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const sourceVisible = !playerOpen || parallel;
  const playerVisible = playerOpen && (!parallel || wide);
  useLayoutEffect(() => {
    for (const [pane, visible] of [[sourcePane.current, sourceVisible], [playerPane.current, playerVisible]] as const) {
      if (!visible && pane?.contains(document.activeElement)) (document.activeElement as HTMLElement)?.blur();
    }
  }, [sourceVisible, playerVisible]);

  // Routes' location override gives the source its true path/query. Only its writes
  // are wrapped; all Back operations still use the single outer MemoryRouter history.
  const sourceNavigation = useMemo(() => {
    if (!playerOpen) return navigation;
    const outer = navigation.navigator;
    const target = (to: Parameters<typeof outer.push>[0]) => parallelSourceTarget(location.search, typeof to === 'string' ? to : createPath(to));
    return { ...navigation, navigator: {
      ...outer,
      push: (to: Parameters<typeof outer.push>[0], state?: unknown, options?: Parameters<typeof outer.push>[2]) => outer.push(target(to), state, options),
      replace: (to: Parameters<typeof outer.replace>[0], state?: unknown, options?: Parameters<typeof outer.replace>[2]) => outer.replace(target(to), state, options),
      go: (delta: number) => outer.go(delta),
      createHref: (to: Parameters<typeof outer.createHref>[0]) => outer.createHref(to),
    } };
  }, [navigation, playerOpen, location.search]);
  const rejectHidden = (visible: boolean) => (event: React.SyntheticEvent) => {
    if (!visible) { event.preventDefault(); event.stopPropagation(); }
  };
  return <div ref={root} className="spotify-workspace" data-player-layout={playerOpen ? (parallel ? 'parallel' : 'full') : 'closed'}>
    <div ref={playerPane} className="spotify-player-pane" inert={!playerVisible} aria-hidden={!playerVisible}
      onClickCapture={rejectHidden(playerVisible)} onInputCapture={rejectHidden(playerVisible)}>
      {playerOpen && <><PlayerPage /><QueueSheet /><SaveLocationSheet /></>}
    </div>
    <div ref={sourcePane} className="spotify-source-pane" inert={!sourceVisible} aria-hidden={!sourceVisible}
      onClickCapture={rejectHidden(sourceVisible)} onInputCapture={rejectHidden(sourceVisible)}>
      <UNSAFE_NavigationContext.Provider value={sourceNavigation}>
        {renderSource(sourceLocation)}
      </UNSAFE_NavigationContext.Provider>
    </div>
  </div>;
}
