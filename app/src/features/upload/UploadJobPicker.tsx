import { jobsInScope } from '../../domain/permissions';
import { useT } from '../../i18n/i18n';
import { useMe } from '../../store/session';
import { useStore } from '../../store/store';

/** Optional upload context (PRD 4.4 step 1): profiles from this batch also join the chosen job's pipeline. */
export function UploadJobPicker({ value, onChange, dark }: { value: string; onChange: (jobId: string) => void; dark?: boolean }) {
  const t = useT();
  const user = useMe();
  const jobs = useStore((s) => s.jobs);
  const open = jobsInScope(user, jobs).filter((j) => j.status === 'open');
  return (
    <label className={`flex items-center gap-2 text-sm font-medium ${dark ? 'text-gray-200' : 'text-[#181211] dark:text-white'}`}>
      {t('upload.job.label')}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 rounded-full px-4 text-sm border ${dark ? 'bg-white/10 border-white/20 text-white' : 'bg-white dark:bg-[#2a2423] border-[#e6dddb] dark:border-[#3a3433]'}`}
      >
        <option value="">{t('upload.job.none')}</option>
        {open.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
      </select>
    </label>
  );
}
