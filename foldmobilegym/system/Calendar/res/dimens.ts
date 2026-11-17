/**
 * Calendar 尺寸常量
 * 对应 AOSP res/values/dimens.xml
 */
export const dimens = {
  weekHourHeight: 60,
  weekGutterWidth: 52,
  weekColumnMinWidth: 96,
  weekEventMinHeight: 24,

  // [icon sizes]
  icSizeTab: 24,
  icSizeNav: 20,
  icSizeAction: 18,
  icSizeService: 28,
  icSizeToolbar: 22,
  icStrokeWidth: 2,    // standard Ic* stroke width
  icSizeChevron: 16,   // list/settings trailing chevron (IcNavForward)
} as const;
