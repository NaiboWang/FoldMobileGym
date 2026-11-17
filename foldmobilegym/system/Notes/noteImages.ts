import { isDocumentReference, type DocumentReference } from '../../os/utils/documentReference';
export interface NoteImage { id: string; source: DocumentReference }
export function cloneNoteImages(images: readonly NoteImage[]): NoteImage[] {
  return images.map(image => ({ id: image.id, source: { id: image.source.id, path: image.source.path, createdAt: image.source.createdAt } }));
}
export function validNoteImages(value: unknown): value is NoteImage[] {
  return Array.isArray(value) && value.every(image => !!image && typeof image.id === 'string' && image.id.length > 0 && isDocumentReference(image.source))
    && new Set(value.map(image => image.id)).size === value.length;
}
export function sameNoteImages(left: readonly NoteImage[] | undefined, right: readonly NoteImage[] | undefined) {
  const a=left ?? [], b=right ?? [];
  return a.length === b.length && a.every((image,index) => image.id === b[index].id && image.source.id === b[index].source.id
    && image.source.path === b[index].source.path && image.source.createdAt === b[index].source.createdAt);
}
export function appendNoteImage(images: readonly NoteImage[] | undefined, source: DocumentReference, candidate: string): NoteImage[] {
  if (!isDocumentReference(source) || !candidate) throw new TypeError('Invalid virtual note image');
  const occupied=new Set((images ?? []).map(image=>image.id));let id=candidate,suffix=1;
  while(occupied.has(id)) id=`${candidate}-${suffix++}`;
  return [...cloneNoteImages(images ?? []),{ id, source:{ id:source.id,path:source.path,createdAt:source.createdAt } }];
}

export function noteImageFields(images: readonly NoteImage[] | undefined): { images?: NoteImage[] } {
  return images !== undefined ? { images: cloneNoteImages(images) } : {};
}
