import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { toast } from '../../components/Toast';
import { CURRENT_USER_ID, userName } from '../../domain/users';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { IntakeModal } from '../intake/IntakeModal';

const TH = 'px-6 py-4 text-xs font-bold text-[#896a61] uppercase tracking-wider border-b border-[#e6dddb] dark:border-[#2a2423]';
const TD = 'px-6 py-4 text-sm text-[#181211] dark:text-white';

export function NotesPage() {
  const t = useT();
  const notes = useStore((s) => s.notes);
  const users = useStore((s) => s.users);
  const [addOpen, setAddOpen] = useState(false);

  const convert = (id: string) => {
    const { created } = useStore.getState().convertNote(id, CURRENT_USER_ID);
    toast(t(created ? 'intake.toast.created' : 'intake.toast.merged'), created ? 'success' : 'info');
  };

  const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <AppLayout
      title={t('notes.title')}
      subtitle={t('notes.subtitle')}
      actions={
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary hover:bg-primary-hover text-white rounded-lg shadow-sm transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          {t('notes.add')}
        </button>
      }
    >
      <div className="bg-[#f8f6f6] dark:bg-[#221410] p-4 md:p-6">
        <div className="bg-white dark:bg-[#1e1e1e] rounded-xl border border-[#e6dddb] dark:border-[#2a2423] shadow-sm overflow-hidden">
          {sorted.length === 0 ? (
            <div className="py-16 text-center text-[#896a61]">
              <span className="material-symbols-outlined text-[40px]">sticky_note_2</span>
              <p className="mt-2 text-sm">{t('notes.empty')}</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#f8f6f6] dark:bg-[#251f1e]">
                <tr>
                  <th className={TH}>{t('notes.col.name')}</th>
                  <th className={TH}>{t('notes.col.contact')}</th>
                  <th className={TH}>{t('notes.col.note')}</th>
                  <th className={TH}>{t('notes.col.addedBy')}</th>
                  <th className={TH}>{t('notes.col.added')}</th>
                  <th className={`${TH} text-center`}>{t('notes.col.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f1f0] dark:divide-[#2a2423]">
                {sorted.map((n) => (
                  <tr key={n.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <td className={`${TD} font-bold whitespace-nowrap`}>{n.name}</td>
                    <td className={`${TD} whitespace-nowrap`}>{n.contact}</td>
                    <td className={`${TD} text-[#896a61] max-w-[320px]`}>{n.text}</td>
                    <td className={`${TD} whitespace-nowrap`}>{userName(users, n.createdBy)}</td>
                    <td className={`${TD} whitespace-nowrap text-[#896a61]`}>{n.createdAt.slice(0, 10)}</td>
                    <td className={`${TD} whitespace-nowrap text-center`}>
                      {n.convertedToCandidateId ? (
                        <Link to={`/candidates/${n.convertedToCandidateId}`} className="text-sm font-medium text-primary hover:underline">
                          {t('notes.viewProfile')}
                        </Link>
                      ) : (
                        <button
                          onClick={() => convert(n.id)}
                          className="px-3 py-1.5 text-sm font-medium border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-[#181211] dark:text-white hover:border-primary hover:text-primary transition-colors"
                        >
                          {t('notes.convert')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <IntakeModal open={addOpen} initialMode="note" onClose={() => setAddOpen(false)} />
    </AppLayout>
  );
}
