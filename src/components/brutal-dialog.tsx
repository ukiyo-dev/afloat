"use client";

import { ReactNode, useRef, cloneElement, isValidElement } from "react";
import { Cross2Icon } from "@radix-ui/react-icons";

export function BrutalDialog({ 
  trigger, 
  title, 
  children 
}: { 
  trigger: ReactNode; 
  title: string; 
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const openDialog = () => {
    dialogRef.current?.showModal();
  };

  const closeDialog = () => {
    dialogRef.current?.close();
  };

  // Attach onClick to trigger if it's a valid element
  const triggerElement = isValidElement(trigger) 
    ? cloneElement(trigger as React.ReactElement<any>, { onClick: openDialog }) 
    : <div onClick={openDialog}>{trigger}</div>;

  return (
    <>
      {triggerElement}
      <dialog 
        ref={dialogRef} 
        className="backdrop:bg-paper/80 backdrop:backdrop-blur-sm bg-transparent p-0 m-auto open:flex flex-col max-w-lg w-full"
        onClick={(e) => {
          if (e.target === dialogRef.current) closeDialog();
        }}
      >
        <div className="panel-brutal !p-0 overflow-hidden w-full" onClick={(e) => e.stopPropagation()}>
          <div className="bg-ink text-white p-4 flex justify-between items-center border-b-2 border-ink">
             <h2 className="font-serif text-2xl font-bold uppercase">{title}</h2>
             <button 
                type="button"
                onClick={closeDialog}
                className="hover:bg-danger hover:text-ink p-1 transition-colors border border-transparent hover:border-ink"
             >
                <Cross2Icon className="w-6 h-6" />
             </button>
          </div>
          <div className="p-6 bg-white">
            {typeof children === 'function' ? children(closeDialog) : children}
          </div>
        </div>
      </dialog>
    </>
  );
}
