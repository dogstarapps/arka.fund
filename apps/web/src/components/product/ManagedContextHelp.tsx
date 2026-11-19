'use client';
import {useId,useRef,type ReactNode} from 'react';

/** Native modal supplies keyboard trapping and Escape; closing restores the trigger. */
export function ManagedContextHelp({title,label,children,icon=false}:{title:string;label:string;children:ReactNode;icon?:boolean}){
 const id=useId(),dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
 return <><button ref={trigger} type="button" className={icon?'managed-help-icon':'surface-text-link managed-help-link'} aria-label={label} aria-haspopup="dialog" onClick={()=>dialog.current?.showModal()}>{icon?<span aria-hidden="true">i</span>:label}</button>
  <dialog ref={dialog} className="managed-help-dialog" aria-labelledby={id} onClose={()=>trigger.current?.focus()}>
   <div className="managed-help-heading"><h2 id={id}>{title}</h2><form method="dialog"><button type="submit" aria-label="Close explanation" className="surface-button surface-button-secondary">Close</button></form></div>
   <div className="managed-help-content">{children}</div>
  </dialog></>;
}
