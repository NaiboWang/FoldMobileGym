import React, { useState } from 'react';
import { IcNavBack } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { getDate } from '../../../os/TimeService';
import { useWeatherGestures } from '../hooks/useWeatherGestures';

const STORAGE_KEY = 'mobilegym.weather.feedback';

const WeatherFeedbackPage: React.FC = () => {
  const s = useAppStrings(strings, stringsEn);
  const { bindBack } = useWeatherGestures();
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');

  const saveLocally = () => {
    if (!message.trim()) return;
    try {
      const previous = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const entries = Array.isArray(previous) ? previous : [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify([
        ...entries.slice(-19),
        { message: message.trim(), createdAt: getDate().toISOString() },
      ]));
      setMessage('');
      setNotice(s.feedback_saved);
    } catch {
      setNotice(s.feedback_save_failed);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#f4f4f4] pt-10 text-black dark:bg-black dark:text-white" data-status-bar-foreground="dark">
      <header className="flex items-center border-b border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#1c1c1e]">
        <button type="button" {...bindBack<HTMLButtonElement>()} className="-ml-2 rounded-full p-2" aria-label={s.feedback_title}>
          <IcNavBack size={24} />
        </button>
        <h1 className="ml-2 text-xl font-medium">{s.feedback_title}</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-4">
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">{s.feedback_hint}</p>
        <textarea
          value={message}
          onChange={(event) => { setMessage(event.target.value); setNotice(''); }}
          placeholder={s.feedback_placeholder}
          aria-label={s.feedback_placeholder}
          maxLength={2000}
          className="min-h-36 w-full resize-y rounded-xl border border-gray-200 bg-white p-3 text-base text-black outline-none focus:border-blue-500 dark:border-white/20 dark:bg-[#1c1c1e] dark:text-white"
        />
        <button
          type="button"
          data-action="feedback.save.local"
          disabled={!message.trim()}
          onClick={saveLocally}
          className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-white disabled:opacity-50"
        >
          {s.feedback_save}
        </button>
        {notice && <p role="status" className="mt-3 text-sm">{notice}</p>}
      </main>
    </div>
  );
};

export default WeatherFeedbackPage;
