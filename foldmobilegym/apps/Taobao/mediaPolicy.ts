import { TAOBAO_LEADING_IMAGE_LIMIT } from './constants';
export function leadingTaobaoImagePriority(index: number): 'high' | 'auto' {
  return Number.isInteger(index) && index >= 0 && index < TAOBAO_LEADING_IMAGE_LIMIT ? 'high' : 'auto';
}
