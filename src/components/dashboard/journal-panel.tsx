import { BrutalDialog } from "../brutal-dialog";
import { ActionForm } from "../action-form";
import { SubmitButton } from "../submit-button";
import { Cross2Icon } from "@radix-ui/react-icons";
import { saveNoteAction, deleteNoteAction } from "../../app/dashboard/actions";
import { DashboardData } from "../../server/services/dashboard-service";

export function JournalPanel({ 
  rangeView, 
  visitorMode = false 
}: { 
  rangeView: DashboardData["rangeView"]; 
  visitorMode?: boolean; 
}) {
  return (
    <section className="panel-brutal bg-[#fffdf5] flex flex-col flex-1 min-h-0">
      <div className="flex justify-between items-start mb-6 border-b-2 border-ink pb-4 shrink-0">
        <div>
          <p className="font-mono text-xs font-bold tracking-widest uppercase mb-1">Journal</p>
          <h2 className="font-serif text-3xl font-bold">每日笔记 <span className="text-xl text-ink-light font-mono ml-2">({rangeView.label})</span></h2>
        </div>
      </div>
      
      {visitorMode ? null : (
        <div className="mb-8 shrink-0">
          <BrutalDialog
            title="New Journal Entry"
            trigger={
              <button type="button" className="btn-brutal inline-flex items-center gap-2 cursor-pointer w-fit text-sm">
                <span className="text-lg leading-none font-bold">+</span> NEW JOURNAL ENTRY
              </button>
            }
          >
            {(close) => (
              <ActionForm className="flex flex-col gap-4" action={saveNoteAction} resetOnSuccess onSuccess={close}>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-xs font-bold uppercase">Date</span>
                    <input className="input-brutal w-full font-mono text-sm" name="date" type="date" defaultValue={rangeView.endDate} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-xs font-bold uppercase">Visibility</span>
                    <select className="input-brutal w-full font-mono text-sm" name="visibility" defaultValue="private">
                      <option value="private">私密 (PRIVATE)</option>
                      <option value="public">公开 (PUBLIC)</option>
                    </select>
                  </label>
                </div>
                <label className="flex flex-col gap-1 mt-2">
                  <span className="font-mono text-xs font-bold uppercase">Content</span>
                  <textarea 
                    className="input-brutal w-full min-h-[160px] font-serif text-lg leading-relaxed resize-y" 
                    name="body" 
                    placeholder="写下今天对计划、偏移与事实的解释..." 
                  />
                </label>
                <div className="flex justify-end mt-4">
                  <SubmitButton className="btn-brutal" pendingText="SAVING...">保存笔记</SubmitButton>
                </div>
              </ActionForm>
            )}
          </BrutalDialog>
        </div>
      )}
      
      <div className="flex flex-col gap-6 flex-1 overflow-y-auto brutal-scrollbar pr-2 mr-[-8px]">
        {rangeView.notes.length === 0 && (
           <div className="flex-1 flex items-center justify-center border-2 border-dashed border-ink/20 shrink-0 min-h-[120px]">
             <p className="font-mono text-ink-light text-center italic">
               这段时间内没有笔记。
             </p>
           </div>
        )}
        {rangeView.notes.map((note) => (
          <article className="border-l-4 border-ink pl-4 py-1" key={note.id}>
            {visitorMode ? (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <time className="font-mono text-sm font-bold bg-ink text-white px-2 py-0.5">{note.date}</time>
                </div>
                <p className="font-serif text-lg leading-relaxed whitespace-pre-wrap">{note.body}</p>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <BrutalDialog
                  title="Edit Journal Entry"
                  trigger={
                    <div className="flex justify-between items-center group/note cursor-pointer">
                      <div className="flex items-center gap-3">
                        <time className="font-mono text-sm font-bold bg-ink text-white px-2 py-0.5">{note.date}</time>
                        <span className="font-mono text-xs px-2 py-0.5 bg-paper border border-ink">
                          {note.visibility === "public" ? "PUBLIC" : "PRIVATE"}
                        </span>
                      </div>
                      <span className="font-mono text-xs opacity-0 group-hover/note:opacity-100 transition-opacity">EDIT</span>
                    </div>
                  }
                >
                  {(close) => (
                    <ActionForm className="flex flex-col gap-4" action={saveNoteAction} onSuccess={close}>
                      <div className="grid grid-cols-2 gap-4">
                        <label className="flex flex-col gap-1">
                          <span className="font-mono text-xs font-bold uppercase">Date</span>
                          <input className="input-brutal w-full font-mono text-sm" name="date" type="date" defaultValue={note.date} readOnly />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="font-mono text-xs font-bold uppercase">Visibility</span>
                          <select className="input-brutal w-full font-mono text-sm" name="visibility" defaultValue={note.visibility}>
                            <option value="private">私密 (PRIVATE)</option>
                            <option value="public">公开 (PUBLIC)</option>
                          </select>
                        </label>
                      </div>
                      <label className="flex flex-col gap-1 mt-2">
                        <span className="font-mono text-xs font-bold uppercase">Content</span>
                        <textarea 
                          className="input-brutal w-full min-h-[160px] font-serif text-lg leading-relaxed resize-y" 
                          name="body" 
                          defaultValue={note.body}
                        />
                      </label>
                      <div className="flex justify-end items-center mt-4 pt-4 border-t-2 border-dashed border-ink/30">
                        <SubmitButton className="btn-brutal" pendingText="SAVING...">更新笔记</SubmitButton>
                      </div>
                    </ActionForm>
                  )}
                </BrutalDialog>
                
                <ActionForm action={deleteNoteAction} className="inline-flex">
                   <input type="hidden" name="date" value={note.date} />
                   <button 
                     type="submit" 
                     className="text-xs font-mono text-danger hover:underline flex items-center gap-1 absolute top-0 right-0 -mt-6 opacity-0 group-hover/note:opacity-100 transition-opacity"
                   >
                     <Cross2Icon /> DELETE
                   </button>
                </ActionForm>
                
                <p className="font-serif text-lg leading-relaxed whitespace-pre-wrap mt-2 relative group-hover/note:z-10">{note.body}</p>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
