import React from 'react';
import { SettingLayout, SettingItemArrow } from './index';
import { useBilibiliGestures } from '../../hooks/useBilibiliGestures';

export const SettingsPlaybackPage: React.FC = () => {
  const { bindTap } = useBilibiliGestures();
  const items = [
    { label: '自动播放设置', tapProps: bindTap<HTMLDivElement>('settings.playback.autoplay.open') },
    { label: '竖屏模式设置', tapProps: bindTap<HTMLDivElement>('settings.playback.portrait.open') },
    { label: '小窗播放/后台听视频设置', tapProps: bindTap<HTMLDivElement>('settings.playback.pip.open') },
    { label: '弹幕/字幕设置', tapProps: bindTap<HTMLDivElement>('settings.playback.danmaku.open') },
    { label: '清晰度设置', tapProps: bindTap<HTMLDivElement>('settings.playback.quality.open') },
    { label: '其他设置', tapProps: bindTap<HTMLDivElement>('settings.playback.other.open') },
  ];

  return (
    <SettingLayout title="播放设置">
      {items.map((item) => (
        <SettingItemArrow
          key={item.label}
          label={item.label}
          tapProps={item.tapProps}
        />
      ))}
      <div className="h-8" />
    </SettingLayout>
  );
};
