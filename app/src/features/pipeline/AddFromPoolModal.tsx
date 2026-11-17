import { useState } from 'react';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { AddToPipelineModal } from '../candidates/AddToPipelineModal';

/** Header / empty-state action: search the Talent Pool, multi-select, confirm source → Applications in New. */
export function AddFromPoolButton({ jobId }: { jobId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const isOpen = useStore((s) => s.jobs.find((j) => j.id === jobId)?.status === 'open');
  if (!isOpen) return null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-6 py-2.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full font-bold shadow-lg shadow-orange-500/20 flex items-center gap-2 transition-all transform active:scale-95 text-sm shrink-0"
      >
        <span className="material-symbols-outlined text-[20px]">person_add</span> {t('pipeline.addFromPool')}
      </button>
      <AddToPipelineModal open={open} jobId={jobId} onClose={() => setOpen(false)} />
    </>
  );
}
