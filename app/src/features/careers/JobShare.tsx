import { useEffect, useState, type ReactNode } from 'react';
import type { Job } from '../../domain/types';
import { useT } from '../../i18n/i18n';

const shareUrl = (job: Job) => `${window.location.origin}/careers/${job.id}`;

/** Copies the job link; the "copied" label shows for two seconds. */
function useCopy(job: Job): [boolean, () => void] {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);
  const copy = () => {
    navigator.clipboard?.writeText(shareUrl(job)).then(() => setCopied(true), () => setCopied(false));
  };
  return [copied, copy];
}

/** Header button: the device share sheet where there is one (phones), otherwise copy the link. */
export function ShareButton({ job }: { job: Job }) {
  const t = useT('careers');
  const [copied, copy] = useCopy(job);
  const share = () => {
    if (typeof navigator.share === 'function') {
      navigator.share({ title: job.title, url: shareUrl(job) }).catch(() => undefined);
    } else copy();
  };
  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white/10 hover:bg-white/15 ring-1 ring-white/15 text-sm font-semibold text-white"
    >
      <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'ios_share'}</span>
      <span aria-live="polite">{t(copied ? 'careers.share.copied' : 'careers.share.button')}</span>
    </button>
  );
}

function Circle({ label, href, onClick, children }: { label: string; href?: string; onClick?: () => void; children: ReactNode }) {
  const cls = 'size-10 grid place-items-center rounded-full bg-gray-100 text-gray-700 hover:bg-sidebar-dark hover:text-white transition-colors';
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className={cls}>{children}</a>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={cls}>{children}</button>
  );
}

/** Sidebar row of share targets: copy link, LinkedIn, Facebook, e-mail. */
export function SharePanel({ job }: { job: Job }) {
  const t = useT('careers');
  const [copied, copy] = useCopy(job);
  const url = encodeURIComponent(shareUrl(job));
  const subject = encodeURIComponent(t('careers.share.emailSubject', { job: job.title }));
  return (
    <div className="mt-6 pt-6 border-t border-hairline">
      <p className="text-sm font-bold">{t('careers.share.title')}</p>
      <div className="mt-3 flex items-center gap-2">
        <Circle label={t('careers.share.copy')} onClick={copy}>
          <span className="material-symbols-outlined text-[20px]">{copied ? 'check' : 'link'}</span>
        </Circle>
        <Circle label="LinkedIn" href={`https://www.linkedin.com/sharing/share-offsite/?url=${url}`}>
          <span className="text-[15px] font-bold leading-none tracking-tight">in</span>
        </Circle>
        <Circle label="Facebook" href={`https://www.facebook.com/sharer/sharer.php?u=${url}`}>
          <span className="text-[17px] font-bold leading-none">f</span>
        </Circle>
        <Circle label={t('careers.share.email')} href={`mailto:?subject=${subject}&body=${url}`}>
          <span className="material-symbols-outlined text-[20px]">mail</span>
        </Circle>
        <span aria-live="polite" className="ml-1 text-xs font-semibold text-emerald-700">{copied ? t('careers.share.copied') : ''}</span>
      </div>
    </div>
  );
}
