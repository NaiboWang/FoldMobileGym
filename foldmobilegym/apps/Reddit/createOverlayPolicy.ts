export function createSheet(search: string): 'flair' | 'discard' | null {
  const value = new URLSearchParams(search).get('sheet');
  return value === 'flair' || value === 'discard' ? value : null;
}
export function hasUnsentPost(title: string, body: string, images: readonly string[]) {
  return title.length > 0 || body.length > 0 || images.length > 0;
}
/** A real parent editor plus its child sheet can return directly to the original origin. */
export function discardBackSteps(index: number, hasEditorParent: boolean) {
  return hasEditorParent && index >= 2 ? 2 : null;
}
