import React from 'react';
import { useMeetingGestures } from '../hooks/useMeetingGestures';
import { useTencentMeetingStrings } from '../hooks/useTencentMeetingStrings';
import { IcLauncher, IcNavBack } from '../res/icons';

export const AboutPage: React.FC = () => {
  const { bindBack } = useMeetingGestures();
  const s = useTencentMeetingStrings();

  return (
    <div className="flex h-full flex-col bg-[#f6f7f9]">
      <header className="flex shrink-0 items-center bg-app-surface px-2 pt-10 pb-3">
        <button className="p-2" {...bindBack()} aria-label={s.settings_title}>
          <IcNavBack size={24} className="text-gray-900" />
        </button>
        <h1 className="flex-1 pr-10 text-center text-[17px] font-medium text-gray-900">{s.menu_about}</h1>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-5 pb-20">
        <div className="flex h-20 w-20 items-center justify-center rounded-[20px] bg-app-surface shadow-sm">
          <IcLauncher size={56} />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">{s.app_name}</h2>
          <p className="mt-1 text-sm text-gray-500">{s.settings_about_version}</p>
        </div>
      </main>
    </div>
  );
};
