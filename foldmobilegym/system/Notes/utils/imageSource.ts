import * as FileSystem from '../../../os/FileSystemService';
import { isDocumentReference, matchesDocumentMime, matchesDocumentReference, type DocumentReference } from '../../../os/utils/documentReference';
export function resolveNoteImageNode(reference: DocumentReference) {
  if(!isDocumentReference(reference))return null;
  const node=FileSystem.getNode(reference.path);
  return matchesDocumentReference(reference,node) && matchesDocumentMime(node,'image/*') ? node : null;
}
function decodeImage(uri: string, signal: AbortSignal): Promise<boolean> {
  return new Promise(resolve=>{
    if(signal.aborted){resolve(false);return;}
    const image=new Image();let done=false;
    const finish=(success:boolean)=>{
      if(done)return;done=true;clearTimeout(timer);signal.removeEventListener('abort',abort);
      image.onload=null;image.onerror=null;image.removeAttribute('src');resolve(success);
    };
    const abort=()=>finish(false);
    const timer=setTimeout(()=>finish(false),8000);
    signal.addEventListener('abort',abort,{once:true});
    image.onload=()=>finish(image.naturalWidth>0&&image.naturalHeight>0);
    image.onerror=()=>finish(false);image.src=uri;
  });
}
/** Only decode the identity-selected simulator file; never substitute a decorative URL. */
export async function loadNoteImage(reference: DocumentReference, signal: AbortSignal): Promise<string|null> {
  if(signal.aborted || !resolveNoteImageNode(reference))return null;
  try{
    const uri=await FileSystem.getFileUriAsync(reference.path);
    if(!uri || signal.aborted || !resolveNoteImageNode(reference) || !await decodeImage(uri,signal))return null;
    return !signal.aborted && resolveNoteImageNode(reference) ? uri : null;
  }catch{return null;}
}
