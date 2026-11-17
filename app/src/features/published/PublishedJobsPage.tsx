import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Modal } from '../../components/Modal';
import { Pagination, usePaginationLabels } from '../../components/Pagination';
import { Popover } from '../../components/Popover';
import { toast } from '../../components/Toast';
import { publishedRows } from '../../domain/published';
import type { Job } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';

const PAGE_SIZE = 20;
const TH = 'px-4 py-4 text-xs font-bold text-[#896a61] uppercase tracking-wider border-b border-[#e6dddb] dark:border-[#2a2423]  ';
const TD = 'px-4 py-4 whitespace-nowrap ';
const ITEM =
  'w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-[#181211] dark:text-white hover:bg-[#f8f6f6] dark:hover:bg-white/5';

export function PublishedJobsPage() {
  const t = useT();
  const paginationLabels = usePaginationLabels();
  const jobs = useStore((s) => s.jobs);
  const applications = useStore((s) => s.applications);
  const [page, setPage] = useState(1);
  const [removing, setRemoving] = useState<Job | null>(null);

  const all = useMemo(() => publishedRows({ jobs, applications }, Date.now()), [jobs, applications]);
  const rows = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const confirmRemove = () => {
    if (!removing) return;
    useStore.getState().setJobStatus(removing.id, 'closed');
    toast(t('published.toast.removed', { title: removing.title }));
    setRemoving(null);
  };

  const openButton = (
    <Link
      to="/careers"
      target="_blank"
      rel="noopener noreferrer"
      className="px-6 py-2.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full font-bold shadow-lg shadow-orange-500/20 flex items-center gap-2 transition-all transform active:scale-95 text-sm shrink-0"
    >
      <span className="material-symbols-outlined text-[20px]">open_in_new</span> {t('published.open')}
    </Link>
  );

  return (
    <AppLayout title={t('nav.published')} subtitle={t('published.subtitle')} actions={openButton}>
      <div className="p-8 max-w-[1400px] mx-auto space-y-8 min-h-full">
        <div className="bg-white dark:bg-surface-dark rounded-[1.5rem] shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-240px)] custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#f8f6f6] dark:bg-[#251f1e] sticky top-0 z-10">
                <tr>
                  {(['jobs.col.title', 'jobs.col.department', 'jobs.col.location', 'jobs.col.level', 'published.col.published', 'published.col.applied'] as const).map((k) => (
                    <th key={k} className={TH}>{t(k)}</th>
                  ))}
                  <th className="px-4 py-4 border-b border-[#e6dddb] dark:border-[#2a2423] text-xs font-bold text-[#896a61] uppercase tracking-wider text-center">{t('jobs.col.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f1f0] dark:divide-[#2a2423]">
                {rows.map(({ job, daysPublished, careersApplicants, campaignApplicants }) => (
                  <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                    <td className={TD}>
                      <div className="flex gap-4 items-center">
                        <div className="size-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-50 text-orange-500">
                          <span className="material-symbols-outlined">work</span>
                        </div>
                        <Link to={`/jobs/${job.id}`} className="font-bold text-sm text-slate-800 dark:text-gray-200 group-hover:text-primary transition-colors">{job.title}</Link>
                      </div>
                    </td>
                    <td className={`${TD} text-sm font-semibold text-slate-600 dark:text-gray-400`}>{job.department}</td>
                    <td className={`${TD} text-sm font-semibold text-slate-600 dark:text-gray-400`}>{job.location}</td>
                    <td className={`${TD} text-sm font-semibold text-slate-600 dark:text-gray-400`}>{job.level}</td>
                    <td className={`${TD} text-sm font-bold text-gray-500`}>{t('jobs.days', { n: daysPublished })}</td>
                    <td
                      className={`${TD} text-sm font-bold text-slate-600 dark:text-gray-400`}
                      title={t('published.applied.detail', { careers: careersApplicants, campaign: campaignApplicants })}
                    >
                      {careersApplicants + campaignApplicants}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <div className="inline-flex items-center gap-2">
                      <Link to={`/careers/${job.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-primary hover:bg-orange-50 dark:hover:bg-white/5 transition-colors">
                        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">open_in_new</span>{t('published.menu.view')}
                      </Link>
                      <Popover
                        align="right"
                        trigger={({ toggle }) => (
                          <button aria-label={`${t('jobs.col.actions')} ${job.title}`} onClick={toggle} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-slate-900 dark:hover:text-white">
                            <span className="material-symbols-outlined">more_horiz</span>
                          </button>
                        )}
                      >
                        {(close) => (
                          <>
                            <Link to={`/pipeline/${job.id}`} onClick={close} className={ITEM}>{t('published.menu.pipeline')}</Link>
                            <button role="menuitem" onClick={() => { close(); setRemoving(job); }} className={ITEM}>{t('published.menu.unpublish')}</button>
                          </>
                        )}
                      </Popover>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-[#896a61]">
                      <p>{t('published.empty')}</p>
                      <Link to="/jobs" className="inline-block mt-2 font-bold text-primary hover:underline">{t('published.empty.link')}</Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination labels={paginationLabels} page={page} pageSize={PAGE_SIZE} total={all.length} noun={t('published.noun')} onPage={setPage} />
        </div>
      </div>
      <Modal
        open={removing !== null}
        title={t('published.confirm.title')}
        onClose={() => setRemoving(null)}
        footer={
          <>
            <button onClick={() => setRemoving(null)} className="px-4 py-2 rounded-lg text-sm font-bold text-[#896a61] hover:bg-[#f8f6f6] dark:hover:bg-white/5">{t('published.confirm.cancel')}</button>
            <button onClick={confirmRemove} className="px-4 py-2 rounded-lg text-sm font-bold bg-[#F97316] hover:bg-[#EA580C] text-white">{t('published.confirm.ok')}</button>
          </>
        }
      >
        {removing && t('published.confirm.body', { title: removing.title })}
      </Modal>
    </AppLayout>
  );
}
