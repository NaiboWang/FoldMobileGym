import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createBrowserTimerSound } from '../../../os/BrowserTimerSound';
import { useClockGestures } from '../hooks/useClockGestures';
import type { AlarmTone } from '../types';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { IcCheck, IcNavBack } from '../res/icons';
import { useSheetDrag } from '../hooks/useSheetDrag';

const TONES: AlarmTone[] = ['classic', 'soft', 'bright'];

export const RingtoneSelectorSheet: React.FC<{
  value?: AlarmTone;
  isEdit: boolean;
  onSelect: (tone: AlarmTone) => void;
  onClose: () => void;
}> = ({ value = 'classic', isEdit, onSelect, onClose }) => {
  const s = useAppStrings(strings, stringsEn);
  const { bindTap, bindBack } = useClockGestures();
  const previewSound = useMemo(() => createBrowserTimerSound(), []);
  const previewTimer = useRef<number | null>(null);
  const previewRevision = useRef(0);
  const [previewing, setPreviewing] = useState<AlarmTone | null>(null);
  const [audioUnavailable, setAudioUnavailable] = useState(false);

  const stopPreview = useCallback(() => {
    previewRevision.current += 1;
    if (previewTimer.current !== null) window.clearTimeout(previewTimer.current);
    previewTimer.current = null;
    previewSound.stop();
    setPreviewing(null);
  }, [previewSound]);

  useEffect(() => () => {
    previewRevision.current += 1;
    if (previewTimer.current !== null) window.clearTimeout(previewTimer.current);
    previewSound.dispose();
  }, [previewSound]);

  const preview = async (tone: AlarmTone) => {
    stopPreview();
    const revision = previewRevision.current;
    const ready = await previewSound.prime();
    if (revision !== previewRevision.current) return;
    if (!ready || !previewSound.play(`clock-tone-preview-${tone}`, tone)) {
      setAudioUnavailable(true);
      return;
    }
    setAudioUnavailable(false);
    setPreviewing(tone);
    previewTimer.current = window.setTimeout(() => {
      previewTimer.current = null;
      previewSound.stop();
      setPreviewing(null);
    }, 2400);
  };

  const selectTone = (tone: AlarmTone) => {
    const onTrigger = () => { stopPreview(); onSelect(tone); };
    if (isEdit) {
      if (tone === 'classic') return bindTap({ kind: 'action', id: 'alarm.edit.ringtone.select.classic' }, { onTrigger });
      if (tone === 'soft') return bindTap({ kind: 'action', id: 'alarm.edit.ringtone.select.soft' }, { onTrigger });
      return bindTap({ kind: 'action', id: 'alarm.edit.ringtone.select.bright' }, { onTrigger });
    }
    if (tone === 'classic') return bindTap({ kind: 'action', id: 'alarm.add.ringtone.select.classic' }, { onTrigger });
    if (tone === 'soft') return bindTap({ kind: 'action', id: 'alarm.add.ringtone.select.soft' }, { onTrigger });
    return bindTap({ kind: 'action', id: 'alarm.add.ringtone.select.bright' }, { onTrigger });
  };

  const previewTone = (tone: AlarmTone, playing: boolean) => {
    const onTrigger = () => { if (playing) stopPreview(); else void preview(tone); };
    const params = { tone };
    return isEdit
      ? bindTap({ kind: 'action', id: 'alarm.edit.ringtone.preview' }, { params, onTrigger })
      : bindTap({ kind: 'action', id: 'alarm.add.ringtone.preview' }, { params, onTrigger });
  };

  const { sheetRef, dragOffset, isDragging, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel } = useSheetDrag(onClose);

  return (
    <div className="absolute inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" {...bindBack()} />
      <div
        ref={sheetRef}
        role="dialog" aria-modal="true" aria-label={s.alarm_tone_title}
        data-clock-dialog="ringtone"
        className="clock-alarm-sheet absolute top-10 left-0 right-0 bottom-0 bg-app-bg rounded-t-[24px] px-5 pt-4 pb-6 flex flex-col"
        style={{ transform: `translateY(${dragOffset}px)`, transition: !isDragging ? 'transform var(--app-duration-short) var(--app-easing-decelerate)' : undefined }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div className="flex justify-center pt-2 pb-3 cursor-grab active:cursor-grabbing touch-none" onPointerDown={handlePointerDown}>
          <div className="w-16 h-1 rounded-full bg-gray-300 -mt-1.5" aria-hidden />
        </div>
        <div className="flex items-center justify-between mb-4">
          <button type="button" aria-label={s.alarm_tone_back} className="w-10 h-10 flex items-center justify-center text-app-text-muted shrink-0" {...bindBack()}>
            <IcNavBack size={26} />
          </button>
          <span className="text-[20px] font-medium flex-1 text-center">{s.alarm_tone_title}</span>
          <div className="w-10 shrink-0" />
        </div>
        <div data-scroll-container="alarmTone" data-scroll-direction="vertical" className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          <p className="px-4 pb-3 text-xs text-app-text-muted">{s.alarm_tone_scope}</p>
          <div className="bg-app-surface rounded-2xl overflow-hidden">
            {TONES.map(tone => {
              const selected = value === tone;
              const playing = previewing === tone;
              return (
                <div key={tone} className="min-h-16 px-4 flex items-center gap-3 border-b border-black/5 last:border-0">
                  <button
                    type="button"
                    aria-pressed={selected}
                    data-ringtone-choice={tone}
                    className="flex-1 min-w-0 py-4 flex items-center justify-between text-left"
                    {...selectTone(tone)}
                  >
                    <span className={`text-[16px] ${selected ? 'text-app-primary font-medium' : 'text-black'}`}>{s[`alarm_tone_${tone}`]}</span>
                    {selected ? <IcCheck size={22} className="text-app-primary shrink-0" /> : null}
                  </button>
                  <button
                    type="button"
                    className="shrink-0 min-w-14 py-3 text-sm text-app-primary"
                    aria-pressed={playing}
                    aria-label={`${playing ? s.alarm_tone_preview_stop : s.alarm_tone_preview}: ${s[`alarm_tone_${tone}`]}`}
                    data-ringtone-preview={tone}
                    {...previewTone(tone, playing)}
                  >
                    {playing ? s.alarm_tone_preview_stop : s.alarm_tone_preview}
                  </button>
                </div>
              );
            })}
          </div>
          {audioUnavailable && <p role="status" className="px-4 pt-3 text-sm text-app-text-muted">{s.alarm_tone_audio_unavailable}</p>}
        </div>
      </div>
    </div>
  );
};
