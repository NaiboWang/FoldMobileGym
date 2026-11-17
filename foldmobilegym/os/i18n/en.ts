/**
 * OS 级英文翻译字典
 *
 * 使用 gettext 风格：中文原文作为 key，英文翻译作为 value。
 * 当 locale 为 'zh-Hans' 时直接返回 key，无需查表。
 *
 * App 名称翻译由各 App 的 manifest.displayNameEn 提供，
 * 通过 patchAppNames() 在 appRegistry 加载后注入。
 */

export const OS_EN: Record<string, string> = {
  '文字操作': 'Text actions',
  '剪切': 'Cut',
  '复制': 'Copy',
  '粘贴': 'Paste',
  '全选': 'Select all',
  '选择分屏应用': 'Choose a split-screen app',
  '选择另一个应用，与当前应用并排使用': 'Choose another app to use side by side',
  '取消分屏': 'Cancel split screen',
  '移动悬浮窗': 'Move floating window',
  '收起悬浮窗': 'Minimize floating window',
  '恢复全屏': 'Restore full screen',
  '关闭悬浮窗': 'Close floating window',
  '调整悬浮窗大小': 'Resize floating window',
  '打开悬浮窗': 'Open floating window',
  '松开选择分屏应用': 'Release to choose a split-screen app',
  '切换分屏方向': 'Switch split orientation',
  '松开进入悬浮窗': 'Release for a floating window',
  // ── 系统 UI 字符串 ──────────────────────────────────────────────
  '加载中...': 'Loading...',
  '正在开发中...': 'Under Development...',
  '应用出现问题': 'App encountered a problem',
  '刷新整个页面': 'Refresh page',
  '重新加载': 'Try again',
  '清除全部': 'Clear All',
  '打开': 'Open',
  '搜索': 'Search',
  '无最近任务': 'No Recent Tasks',
};

/** appRegistry 加载 manifest 后注入 App 名称翻译 */
export function patchAppNames(entries: Record<string, string>) {
  Object.assign(OS_EN, entries);
}
