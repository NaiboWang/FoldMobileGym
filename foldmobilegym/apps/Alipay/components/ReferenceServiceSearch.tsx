import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAlipayStore } from '../state';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { useLocale } from '../locale';
import { localizeServiceName } from '../utils/localizeCatalog';
import { REFERENCE_PUBLIC_SERVICES, REFERENCE_LIFE_SERVICES } from '../constants';
import { IconRenderer } from './IconRenderer';
import { IcNavBack, IcSearch, IcDelete } from '../res/icons';

type Props = {
  backProps: React.ButtonHTMLAttributes<HTMLButtonElement>;
  clearProps: React.ButtonHTMLAttributes<HTMLButtonElement>;
  transferProps: React.ButtonHTMLAttributes<HTMLButtonElement>;
  getSubmitProps: (query: string) => React.ButtonHTMLAttributes<HTMLButtonElement>;
  inputAttributes: (value: string) => Record<string, string>;
  submit: (query: string) => void;
};

/** Controlled local catalog search, not the vendor's network search. */
export function ReferenceServiceSearch({ backProps, clearProps, transferProps, getSubmitProps, inputAttributes, submit }: Props) {
  const services = useAlipayStore(state => state.mainServices);
  const common = useAlipayStore(state => state.commonServices);
  const finance = useAlipayStore(state => state.financeServices);
  const civic = useAlipayStore(state => state.myCivicServices);
  const history = useAlipayStore(state => state.serviceSearchHistory) ?? [];
  const s = useAlipayStrings();
  const english = useLocale() === 'en';
  const [search] = useSearchParams();
  const query = search.get('q') ?? '';
  const [draft, setDraft] = React.useState(query);
  const input = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => setDraft(query), [query]);
  React.useEffect(() => {
    const timer = window.setTimeout(() => input.current?.focus({ preventScroll: true }), 120);
    return () => window.clearTimeout(timer);
  }, []);
  const catalog = [...new Map([...services, ...common, ...finance, ...civic, ...REFERENCE_PUBLIC_SERVICES, ...REFERENCE_LIFE_SERVICES]
    .filter(item => item.id !== 'more').map(item => [item.id, item])).values()];
  const normalized = query.trim().normalize('NFKC').toLocaleLowerCase();
  const matches = normalized ? catalog.filter(item => [item.name, item.id, localizeServiceName(item.id, item.name, true)]
    .some(name => name.normalize('NFKC').toLocaleLowerCase().includes(normalized))) : [];
  return <div className="alipay-reference-service-search">
    <header className="alipay-reference-search-header">
      <button type="button" aria-label={s.reference_yuebao_back} {...backProps}><IcNavBack size={24} /></button>
      <div className="alipay-reference-search-field"><IcSearch size={18} aria-hidden="true" />
        <input ref={input} type="search" value={draft} maxLength={100} aria-label={s.reference_service_search_label}
          placeholder={s.search} {...inputAttributes(draft)} onChange={event => setDraft(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); submit(draft); } }} />
        <button type="button" {...getSubmitProps(draft)}>{s.search}</button>
      </div>
    </header>
    {!normalized ? <section>
      <div className="alipay-reference-search-history-heading"><h2>{s.reference_service_search_history}</h2>
        {history.length > 0 && <button type="button" aria-label={s.reference_service_search_clear} {...clearProps}><IcDelete size={18} /></button>}
      </div>
      <div className="alipay-reference-search-history">{history.map(term => <button key={term} type="button" {...getSubmitProps(term)}>{term}</button>)}</div>
      {history.length === 0 && <p className="alipay-reference-service-note">{s.reference_service_search_empty_history}</p>}
    </section> : <section>
      <h2>{s.reference_service_search_results}</h2>
      <div className="alipay-reference-search-results">{matches.map(service => {
        const body = <><IconRenderer name={service.icon} size={28} color={service.color} /><span>{localizeServiceName(service.id, service.name, english)}</span></>;
        return service.id === 'transfer' ? <button key={service.id} type="button" {...transferProps}>{body}</button> : <div key={service.id}>{body}</div>;
      })}</div>
      {matches.length === 0 && <p className="alipay-reference-service-note">{s.reference_service_search_no_results}</p>}
    </section>}
    <p className="alipay-reference-service-note">{s.reference_service_search_scope}</p>
  </div>;
}
