import React, { useEffect, useRef, useState } from 'react';
import { AudioLines, Bot, Grid3X3, Mic, MicOff, MoreHorizontal, PhoneOff, Plus, Video, Volume2, VolumeX } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useActivityId } from '../../../os/ActivityContext';
import { useAppStrings } from '../../../os/useAppStrings';
import { CONTACTS_CONFIG } from '../data';
import { useContactsList } from '../state';
import { dialNumbersMatch } from '../utils/dialNumber';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import './simulated-call.css';

/** A local visual simulation only: no phone, microphone or network APIs are used. */
export const SimulatedCallPage: React.FC = () => {
  const s = useAppStrings(strings, stringsEn);
  const activityId = useActivityId();
  const [params] = useSearchParams();
  const number = params.get('number') ?? '';
  const contacts = useContactsList();
  const contact = contacts.find(item => item.phones.some(phone => dialNumbersMatch(phone.number, number)));
  const call = CONTACTS_CONFIG.callLogs.find(entry => dialNumbersMatch(entry.number, number));
  const name = contact?.displayName || call?.displayName || number || '--';
  const buttonRef = useRef<HTMLButtonElement>(null);
  const ended = useRef(false);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const ownsScreen = () => {
    const os = window.__OS__?.getState();
    const top = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
    const route = window.__OS__?.getAppRoute('contacts')?.path ?? '';
    return !os?.isLauncherVisible && !os?.isRecentsVisible && top?.activityId === activityId
      && route.split('?')[0] === '/calling';
  };
  useEffect(() => {
    const frame = requestAnimationFrame(() => { if (ownsScreen()) buttonRef.current?.focus(); });
    return () => cancelAnimationFrame(frame);
  // The activity and route are fixed for this screen's mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const end = () => {
    if (ended.current || !ownsScreen()) return;
    ended.current = true;
    window.__OS__?.handleBack();
  };
  const options = [
    {Icon:AudioLines, label:s.simulated_call_record}, {Icon:Bot, label:s.simulated_call_ai}, {Icon:Plus, label:s.simulated_call_add},
    {Icon:Video, label:s.simulated_call_video}, {Icon:Mic, label:s.simulated_call_mute}, {Icon:MoreHorizontal, label:s.simulated_call_more},
    {Icon:Grid3X3, label:s.simulated_call_keypad}, null, {Icon:Volume2, label:s.simulated_call_speaker},
  ];
  const toggle = (index: number) => {
    if (!ownsScreen()) return;
    if (index === 4) setMuted(value => !value);
    if (index === 8) setSpeaker(value => !value);
  };
  return <section className="contacts-simulated-call" data-simulated-call-screen data-status-bar-foreground="light" data-navigation-bar-foreground="light">
    <header className="contacts-simulated-call-heading">
      <h1>{name}</h1>
      {name !== number && number && <div className="contacts-simulated-call-number">{number}</div>}
      <p role="status">{s.simulated_call_status}</p>
    </header>
    <div className="contacts-simulated-call-controls">
      {options.map((option, index) => option ? (() => {
        const toggleable = index === 4 || index === 8;
        const pressed = index === 4 ? muted : index === 8 ? speaker : false;
        const Icon = index === 4 && muted ? MicOff : index === 8 && speaker ? VolumeX : option.Icon;
        const label = index === 4 && muted ? s.simulated_call_mute_active : index === 8 && speaker ? s.simulated_call_speaker_active : option.label;
        return <div className="contacts-simulated-call-control" key={option.label}>
        <button type="button" disabled={!toggleable} aria-label={label} aria-pressed={toggleable ? pressed : undefined}
          data-simulated-call-control={index === 4 ? 'mute' : index === 8 ? 'speaker' : undefined}
          title={toggleable ? label : s.simulated_call_unsupported}
          className={pressed ? 'is-active' : undefined} onClick={toggleable ? () => toggle(index) : undefined}><Icon size={22} aria-hidden="true" /></button>
        {index < 6 && <span>{option.label}</span>}
      </div>;
      })() : <div className="contacts-simulated-call-control" key="end">
        <button ref={buttonRef} type="button" data-simulated-call-end aria-label={s.simulated_call_end} className="contacts-simulated-call-hangup" onClick={end}><PhoneOff size={23} aria-hidden="true" /></button>
      </div>)}
    </div>
  </section>;
};
