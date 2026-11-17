import React, { useEffect, useState } from 'react';
import type { NoteImage } from '../noteImages';
import { loadNoteImage, resolveNoteImageNode } from '../utils/imageSource';
import * as FileSystem from '../../../os/FileSystemService';
import { useOS } from '../../../os/OSContext';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { IcDelete } from '../res/icons';
export const NoteImageBlock: React.FC<{ image: NoteImage; openProps: React.HTMLAttributes<HTMLButtonElement>; removeProps: React.HTMLAttributes<HTMLButtonElement>; readOnly: boolean; busy: boolean }> = ({ image,openProps,removeProps,readOnly,busy })=>{
  const [,refreshFiles]=useState(0);
  useEffect(()=>FileSystem.subscribeDestructiveOperationCounts(()=>refreshFiles(value=>value+1)),[]);
  useOS(); // Returning from another Activity revalidates shared-file identity even without a Notes store change.
  const s=useAppStrings(strings,stringsEn),source=image.source,node=resolveNoteImageNode(source);
  const key=JSON.stringify(source),available=!!node;
  const [loaded,setLoaded]=useState<{key:string;uri:string|null;pending:boolean}>({key,uri:null,pending:true});
  useEffect(()=>{
    const abort=new AbortController();setLoaded({key,uri:null,pending:available});
    if(available)void loadNoteImage(source,abort.signal).then(uri=>{if(!abort.signal.aborted)setLoaded({key,uri,pending:false});});
    return()=>abort.abort();
  },[key,available]);
  const uri=available&&loaded.key===key?loaded.uri:null;
  const pending=available&&(loaded.key!==key||loaded.pending);
  return <figure className="notes-image-block" data-notes-image={image.id} data-image-source-id={source.id}>
    <button type="button" className="notes-image-preview" {...openProps} disabled={!uri} aria-label={s.image_open}>
      {uri?<img src={uri} alt={s.image_alt.replace('{name}',node?.name??'')} draggable={false}
        onError={()=>setLoaded({key,uri:null,pending:false})}/>:<span role="status">{pending?s.image_loading:s.image_unavailable}</span>}
    </button>
    <figcaption><span>{node?.name??source.path.split('/').at(-1)}</span>
      {!readOnly&&<button type="button" disabled={busy} aria-label={s.image_remove} {...removeProps}><IcDelete size={18}/></button>}
    </figcaption>
  </figure>;
};
