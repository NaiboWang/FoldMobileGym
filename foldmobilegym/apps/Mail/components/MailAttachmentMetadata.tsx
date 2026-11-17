import React from 'react';
import type { FSNode } from '../../../os/types';
import { matchesDocumentReference, type DocumentReference } from '../../../os/utils/documentReference';

/** Show the borrowed reference, never metadata from a replacement at its path. */
export function MailAttachmentMetadata({ reference, node, unavailable }: {
  reference: DocumentReference;
  node: FSNode | null;
  unavailable: string;
}) {
  const available = matchesDocumentReference(reference, node);
  return <div className="mail-attachment-copy">
    <strong>{available ? node.name : reference.path.split('/').at(-1)}</strong>
    <small className="mail-attachment-path" dir="ltr">{reference.path}</small>
    <small>{available ? [node.mimeType, `${node.size} B`].filter(Boolean).join(' · ') : unavailable}</small>
  </div>;
}
