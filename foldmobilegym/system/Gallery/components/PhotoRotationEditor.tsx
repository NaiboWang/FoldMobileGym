import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MediaItem } from '../../../os/types';
import * as FileSystem from '../../../os/FileSystemService';
import * as TimeService from '../../../os/TimeService';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useGalleryGestures } from '../hooks/useGalleryGestures';
import { useGalleryPageOwner } from '../useGalleryPageOwner';
import { captureGalleryPageLease } from '../pageLease';
import { captureGallerySource, isGallerySourceCurrent, type GallerySource } from '../viewerSource';
import { rotationGeometry, isStillRotationSource } from '../rotationGeometry';

/** Non-destructive PNG copies of real decoded source pixels, never thumbnails. */
export function PhotoRotationEditor({ item, intentMode }: { item: MediaItem; intentMode: boolean }) {
  const s = useAppStrings(strings, stringsEn);
  const { bindTap, bindBack, go } = useGalleryGestures();
  const ownsPage = useGalleryPageOwner();
  const [source] = useState(() => {
    const node = FileSystem.getNode(item.path);
    return captureGallerySource(item, node, node ? FileSystem.getFileContentToken(node) : null);
  });
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [turns, setTurns] = useState(0);
  const [error, setError] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedPath, setSavedPath] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const pending = useRef(false), saved = useRef(''), mounted = useRef(false);
  const copySource = useRef<GallerySource | null>(null);
  const sourceCurrent = useCallback(() => {
    const node = FileSystem.getNode(item.path);
    return isGallerySourceCurrent(source, node, node ? FileSystem.getFileContentToken(node) : null);
  }, [item.path, source]);
  useEffect(() => {
    let live = true, decoded: ImageBitmap | undefined;
    mounted.current = true;
    void (async () => {
      try {
        if (!source || !item.mimeType.startsWith('image/') || !sourceCurrent()) throw new Error('Source unavailable');
        const blob = await FileSystem.readFile(item.path);
        if (!blob || !live || !sourceCurrent()) throw new Error('Source changed');
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (!live) return;
        if (!isStillRotationSource(bytes, item.mimeType)) { setUnsupported(true); return; }
        decoded = await createImageBitmap(blob);
        if (!live) { decoded.close(); return; }
        if (!sourceCurrent()) throw new Error('Source changed');
        setBitmap(decoded);
      } catch { if (live) setError(true); }
    })();
    return () => { live = false; mounted.current = false; decoded?.close(); };
  }, [source, item.path, item.mimeType, sourceCurrent]);
  useLayoutEffect(() => {
    if (!bitmap || !canvas.current) return;
    try {
      const geometry = rotationGeometry(bitmap.width, bitmap.height, turns);
      const target = canvas.current;
      target.width = geometry.width; target.height = geometry.height;
      const context = target.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      context.translate(geometry.width / 2, geometry.height / 2);
      context.rotate(geometry.quarterTurns * Math.PI / 2);
      context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    } catch { setError(true); }
  }, [bitmap, turns]);
  const editable = () => {
    if (!ownsPage()) return false;
    if (!sourceCurrent()) { setError(true); return false; }
    return !!bitmap && !error && !unsupported && !pending.current && !saved.current;
  };
  const save = async () => {
    if (!editable() || !turns || !canvas.current) return;
    pending.current = true; setSaving(true);
    const lease = captureGalleryPageLease(ownsPage);
    try {
      const target = canvas.current;
      const width = target.width, height = target.height;
      const blob = await new Promise<Blob>((resolve, reject) => target.toBlob(value => value ? resolve(value) : reject(new Error('PNG encoding failed')), 'image/png'));
      // Cancelled, replaced or backgrounded before committing: create no file.
      if (!lease.isCurrent()) return;
      if (!sourceCurrent()) { setError(true); return; }
      const parent = item.path.slice(0, item.path.lastIndexOf('/'));
      let path: string;
      do { path = `${parent}/edited-${TimeService.now()}-${crypto.randomUUID()}.png`; } while (FileSystem.getNode(path));
      // Once this explicit write begins it may finish in the background. It never
      // overwrites the original or navigates another Activity on completion.
      const node = await FileSystem.writeFile(path, blob, { mimeType: 'image/png' });
      const expectedRevision = FileSystem.getFileContentToken(node);
      if (FileSystem.getNode(path) !== node) throw new Error('Copy changed');
      await FileSystem.setMetadata(path, { width, height });
      const revision = FileSystem.getFileContentToken(node);
      if (revision === null || revision !== expectedRevision || FileSystem.getNode(path) !== node) throw new Error('Copy unavailable');
      copySource.current = { node, metadata: { ...node }, revision };
      saved.current = path;
      if (mounted.current) setSavedPath(path);
    } catch { if (mounted.current) setError(true); }
    finally { lease.release(); pending.current = false; if (mounted.current) setSaving(false); }
  };
  return <section className="gallery-rotation-editor" role="dialog" aria-modal="true" aria-label={s.editor_rotate_title} data-gallery-editor="rotate" data-saved-photo={savedPath || undefined}>
    <header><button type="button" {...bindBack()}>{savedPath ? s.editor_done : saving ? s.viewer_back : s.dialog_cancel}</button><h2>{s.editor_rotate_title}</h2></header>
    <div className="gallery-rotation-preview" data-scroll-container="editor" data-scroll-direction="vertical">
      {error || unsupported ? <p role="alert">{unsupported ? s.editor_unsupported : s.editor_failed}</p> : <>
        {!bitmap && <p role="status">{s.editor_loading}</p>}
        <canvas ref={canvas} aria-label={s.editor_preview} hidden={!bitmap} />
      </>}
    </div>
    {savedPath && <p role="status" className="gallery-rotation-status">{s.editor_copy_saved}</p>}
    <footer>
      <button type="button" disabled={!bitmap || error || saving || !!savedPath}
        {...bindTap(intentMode ? { kind: 'action', id: 'gallery.intent.editor.rotate' } : { kind: 'action', id: 'gallery.editor.rotate' }, { onTrigger: () => { if (editable()) setTurns(value => (value + 1) % 4); } })}>{s.editor_rotate_right}</button>
      <button type="button" disabled={!turns || error || saving || !!savedPath}
        {...bindTap(intentMode ? { kind: 'action', id: 'gallery.intent.editor.reset' } : { kind: 'action', id: 'gallery.editor.reset' }, { onTrigger: () => { if (editable()) setTurns(0); } })}>{s.editor_reset}</button>
      {savedPath ? <button type="button" {...bindTap('photo.edit.copy.open', { params: { path: encodeURIComponent(savedPath) }, onTrigger: () => { const node = FileSystem.getNode(saved.current); if (ownsPage() && isGallerySourceCurrent(copySource.current, node, node ? FileSystem.getFileContentToken(node) : null)) go('photo.edit.copy.open', { path: encodeURIComponent(saved.current) }); } })}>{s.editor_view_copy}</button>
        : <button type="button" disabled={!bitmap || !turns || error || saving}
          {...bindTap(intentMode ? { kind: 'action', id: 'gallery.intent.editor.save.copy' } : { kind: 'action', id: 'gallery.editor.save.copy' }, { onTrigger: () => { void save(); } })}>{saving ? s.editor_saving : s.editor_save_copy}</button>}
    </footer>
  </section>;
}
