import { Link, useSearchParams } from 'react-router-dom';
import { STAGES } from '../../domain/stages';
import type { Stage } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';

/** Confirmation page, or the friendly "already applied" variant (`?dup=1&stage=...`). */
export function Applied() {
  const t = useT('careers');
  const [params] = useSearchParams();
  const job = useStore((s) => s.jobs.find((j) => j.id === params.get('job')));
  const dup = params.get('dup') === '1';
  const stage = STAGES.find((s: Stage) => s === params.get('stage'));
  const jobTitle = job?.title ?? '';
  return (
    <div data-testid={dup ? 'careers-already-applied' : 'careers-applied'} className="max-w-xl mx-auto text-center bg-white rounded-3xl border border-[#e6dddb] p-8 sm:p-12">
      <span className="material-symbols-outlined icon-filled text-primary text-5xl">{dup ? 'info' : 'check_circle'}</span>
      <h1 className="text-2xl font-bold mt-4">{t(dup ? 'careers.applied.dupTitle' : 'careers.applied.title')}</h1>
      <p className="text-[#896a61] mt-2">
        {dup
          ? t('careers.applied.dupBody', { job: jobTitle, stage: stage ? t(`careers.stage.${stage}`) : '' })
          : t('careers.applied.body', { job: jobTitle })}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/careers/login" className="px-6 py-3 rounded-full bg-primary text-white font-bold text-sm">
          {t('careers.applied.follow')}
        </Link>
        <Link to="/careers" className="px-6 py-3 rounded-full ring-1 ring-[#e6dddb] font-bold text-sm hover:ring-primary/50">
          {t('careers.applied.browse')}
        </Link>
      </div>
    </div>
  );
}
