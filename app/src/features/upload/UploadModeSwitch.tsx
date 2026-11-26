import { Link } from 'react-router-dom';
import { useShowNew } from '../../hooks';
import { useT } from '../../i18n/i18n';

/** Standard | Bulk (Ultra) segmented switch shown on both upload pages. Hidden under the mockup fixture. */
export function UploadModeSwitch({ mode }: { mode: 'normal' | 'ultra' }) {
  const t = useT();
  if (!useShowNew()) return null;
  const items = [
    { id: 'normal', to: '/upload', label: t('upload.mode.normal'), icon: 'upload_file' },
    { id: 'ultra', to: '/upload-ultra', label: t('upload.mode.ultra'), icon: 'bolt' },
  ] as const;
  return (
    <nav className="inline-flex self-start items-center gap-0.5 rounded-lg bg-gray-100 dark:bg-white/5 p-0.5" aria-label={t('upload.mode.label')}>
      {items.map((i) => {
        const active = i.id === mode;
        return (
          <Link
            key={i.id}
            to={i.to}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-bold transition-colors ${
              active ? 'bg-white dark:bg-[#2a2423] text-[#181211] dark:text-white shadow-sm' : 'text-[#896a61] hover:text-[#181211] dark:hover:text-white'
            }`}
          >
            <span aria-hidden="true" className={`material-symbols-outlined text-[16px] ${active ? 'text-primary' : ''}`}>{i.icon}</span>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
