import React from 'react';
import { Accessibility, Keyboard, Settings } from 'lucide-react';
import { useSettingsStrings } from '../res/useSettingsStrings';
import { useSettingsGestures } from '../hooks/useSettingsGestures';

type Props = {
  query: string;
  selectedPageId?: string;
  onOpenPage: (pageId: string) => void;
};

type ResultRow = {
  title: string;
  summaries?: string[];
  pageId?: string;
  primary?: boolean;
};

export const InputMethodSearchResults: React.FC<Props> = ({ query, selectedPageId, onOpenPage }) => {
  const { s } = useSettingsStrings();
  const { bindTap } = useSettingsGestures();
  const path = `${s.system_and_updates} > ${s.language_input_title}`;
  const groups: Array<{
    id: 'writing' | 'accessibility' | 'system';
    icon: React.ReactNode;
    rows: ResultRow[];
  }> = [
    {
      id: 'writing',
      icon: <Keyboard size={25} strokeWidth={2.2} />,
      rows: [
        { title: s.super_writing, summaries: [s.baidu_input_honor] },
        { title: s.breath_voice_input_text, summaries: [s.sogou_input_honor] },
        { title: s.breath_voice_input_text, summaries: [s.baidu_input_honor] },
        { title: s.smart_input, summaries: [s.sogou_input_honor] },
      ],
    },
    {
      id: 'accessibility',
      icon: <Accessibility size={26} strokeWidth={2.4} />,
      rows: [
        { title: s.sogou_input, summaries: [`${s.accessibility} > ${s.barrier_free}`] },
        { title: s.baidu_input_honor, summaries: [`${s.accessibility} > ${s.barrier_free}`] },
      ],
    },
    {
      id: 'system',
      icon: <Settings size={25} strokeWidth={2.2} />,
      rows: [
        { title: s.sogou_input_honor, summaries: [s.chinese_china, path], pageId: 'language_and_input' },
        { title: s.default, summaries: [path], pageId: 'language_and_input' },
        { title: s.language_input_title, summaries: [s.system_and_updates], pageId: 'language_and_input', primary: true },
        { title: s.baidu_input_honor, summaries: [s.chinese_china, path], pageId: 'language_and_input' },
      ],
    },
  ];

  return <div className="settings-input-search-results" data-settings-input-search-results>
    {groups.map(group => <section
      key={group.id}
      className="settings-input-search-group"
      data-settings-input-search-group={group.id}
    >
      <div className={`settings-input-search-icon settings-input-search-icon-${group.id}`} data-settings-input-search-icon aria-hidden="true">
        {group.icon}
      </div>
      <div className="settings-input-search-rows">
        {group.rows.map((row, index) => {
          const content = <>
            <div className="settings-input-search-title"><HighlightedText text={row.title} query={query} /></div>
            {row.summaries?.map((summary, summaryIndex) => <div className="settings-input-search-summary" key={`${summary}-${summaryIndex}`}><HighlightedText text={summary} query={query} /></div>)}
          </>;
          if (!row.pageId) return <div className="settings-input-search-row" key={`${row.title}-${index}`}>{content}</div>;
          return <button
            type="button"
            className="settings-input-search-row settings-input-search-button"
            key={`${row.title}-${index}`}
            data-settings-search-result={row.primary ? row.pageId : undefined}
            data-settings-search-target={row.pageId}
            aria-current={row.primary && selectedPageId === row.pageId ? 'page' : undefined}
            {...bindTap('settings.search.result.open', {
              params: { pageId: row.pageId },
              onTrigger: () => onOpenPage(row.pageId!),
            })}
          >{content}</button>;
        })}
      </div>
    </section>)}
  </div>;
};

function HighlightedText({ text, query }: { text: string; query: string }) {
  const terms = query.includes('输入法') ? ['输入法'] : ['input method', 'input'];
  const lower = text.toLowerCase();
  const term = terms.find(candidate => lower.includes(candidate.toLowerCase()));
  if (!term) return <>{text}</>;
  const index = lower.indexOf(term.toLowerCase());
  return <>{text.slice(0, index)}<mark>{text.slice(index, index + term.length)}</mark>{text.slice(index + term.length)}</>;
}
