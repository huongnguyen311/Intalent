import { Link } from 'react-router-dom';
import { useShowNew } from '../../hooks';
import { useT } from '../../i18n/i18n';

/** Standard | Bulk (Ultra) switch shown on both upload pages. Hidden under the mockup fixture. */
export function UploadModeSwitch({ mode, dark }: { mode: 'normal' | 'ultra'; dark?: boolean }) {
  const t = useT();
  if (!useShowNew()) return null;
  const items = [
    { id: 'normal', to: '/upload', label: t('upload.mode.normal') },
    { id: 'ultra', to: '/upload-ultra', label: t('upload.mode.ultra') },
  ] as const;
  const wrap = dark ? 'inline-flex items-center gap-1 bg-white/5 border border-white/20 rounded-2xl p-1' : 'flex items-center gap-1 bg-white border border-gray-100 rounded-2xl p-1 shadow-sm';
  return (
    <nav className={wrap} aria-label="Upload mode">
      {items.map((i) => {
        const active = i.id === mode;
        const cls = active ? (dark ? 'bg-white text-slate-900' : 'bg-slate-900 text-white') : dark ? 'text-gray-300 hover:text-white' : 'text-gray-400 hover:text-slate-700';
        return (
          <Link key={i.id} to={i.to} aria-current={active ? 'page' : undefined} className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-colors ${cls}`}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
