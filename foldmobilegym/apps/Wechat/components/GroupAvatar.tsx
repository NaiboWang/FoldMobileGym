import React from 'react';
import type {GroupMember} from '../types';

/** A mosaic of source-backed members; never a fabricated group photo. */
export function GroupAvatar({members, className = ''}: {members: GroupMember[]; className?: string}) {
  return <div aria-hidden="true" className={`grid grid-cols-3 content-center gap-[1px] p-[2px] rounded-[6px] bg-(--app-c-tw-bg-gray-200) overflow-hidden ${className}`}>
    {members.slice(0, 9).map((member, index) => member.avatar
      ? <img key={`${member.wxid}-${index}`} src={member.avatar} alt="" className="aspect-square w-full object-cover"/>
      : <span key={`${member.wxid}-${index}`} className="aspect-square bg-app-surface"/>)}
  </div>;
}
