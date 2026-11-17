import React from 'react';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useMeituanGestures } from '../hooks/useMeituanGestures';
import { MeituanHomeSurface, type HomeSurfaceProps } from '../components/MeituanHomeSurface';

export function MeituanHome(props: HomeSurfaceProps & {
  searchHeader: React.ReactNode; homeResults: React.ReactNode; onResultsPointerDown: React.PointerEventHandler<HTMLElement>;
}) {
  const { searchOpen, searchHeader, filters, results, homeResults, onResultsPointerDown } = props;
  const t = useAppStrings(strings, stringsEn);
  const { bindBack } = useMeituanGestures();
  return <div className="mt-super-layout" data-meituan-main-home="true" data-search-open={searchOpen}>
    <MeituanHomeSurface {...props} results={homeResults} filters={searchOpen ? null : filters} onHomePointerDown={onResultsPointerDown}/>
    {searchOpen && <section className="mt-super-results-pane" data-meituan-search-results="true">
      <header className="mt-super-results-header"><button aria-label={t.back} {...bindBack()}>‹</button><b>{t.main_search_results}</b></header>
      {searchHeader}
      <main className="mt-main" data-scroll-container="shops" data-scroll-direction="vertical" data-keep-keyboard="true" onPointerDown={onResultsPointerDown}>
        <p className="mt-super-scope">{t.main_search_scope}</p>{filters}{results}
      </main>
    </section>}
  </div>;
}
