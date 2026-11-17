// At most two leading rows of the existing two/three-column product layouts.
export const TAOBAO_LEADING_IMAGE_LIMIT = 6;

export const TAOBAO_MESSAGE_CHANNELS = [
  { id: 'logistics', group: 'priority', tone: 'orange' },
  { id: 'aftersale', group: 'priority', tone: 'blue' },
  { id: 'promotion', group: 'promotion', tone: 'rose', dismissible: true },
  { id: 'assistant', group: 'standard', tone: 'assistant' },
  { id: 'coins', group: 'standard', tone: 'gold' },
  { id: 'offers', group: 'standard', tone: 'pink' },
  { id: 'vip', group: 'standard', tone: 'dark' },
  { id: 'interactive', group: 'standard', tone: 'coral' },
  { id: 'service', group: 'standard', tone: 'yellow' },
  { id: 'system', group: 'standard', tone: 'cream' },
] as const;

export type TaobaoMessageThreadId = (typeof TAOBAO_MESSAGE_CHANNELS)[number]['id'];
