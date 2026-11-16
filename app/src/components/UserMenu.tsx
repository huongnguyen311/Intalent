import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../i18n/i18n';
import { useStore } from '../store/store';
import { Modal } from './Modal';
import { toast } from './Toast';

const ITEM = 'w-full text-left px-3 py-2 rounded-md text-sm text-[#e6dddb] hover:bg-white/5 hover:text-white';

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [lang, setLang] = useLang();
  const navigate = useNavigate();

  const reset = () => {
    useStore.getState().resetDemo();
    setConfirming(false);
    setOpen(false);
    toast('Demo data reset');
  };

  return (
    <div className="p-4 border-t border-border-dark relative">
      {open && (
        <div className="absolute bottom-full left-4 right-4 mb-2 p-2 bg-sidebar-dark border border-border-dark rounded-lg shadow-2xl flex flex-col gap-1">
          <div className="flex gap-1 p-1">
            {(['en', 'vi'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`flex-1 px-2 py-1 rounded-md text-xs font-semibold ${lang === l ? 'bg-primary text-white' : 'text-[#e6dddb] hover:bg-white/5'}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <button className={ITEM} onClick={() => setConfirming(true)}>Reset demo data</button>
          <button className={ITEM} onClick={() => navigate('/login')}>Log out</button>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-3 w-full p-2 rounded-lg transition-colors text-left group hover:bg-white/5">
        <div className="size-9 rounded-full bg-cover bg-center border border-[#3a3433] bg-gradient-to-br from-primary to-orange-400 group-hover:border-primary transition-colors flex items-center justify-center">
          <span className="text-white text-sm font-bold">SA</span>
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="text-sm font-medium truncate text-white">Super Admin</span>
          <span className="text-xs truncate text-[#896a61]">SuperAdmin</span>
        </div>
        <span className="material-symbols-outlined ml-auto text-lg text-[#896a61]">expand_more</span>
      </button>
      <Modal
        open={confirming}
        title="Reset demo data"
        onClose={() => setConfirming(false)}
        footer={
          <>
            <button onClick={() => setConfirming(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-[#e6dddb] dark:border-[#3a3433]">Cancel</button>
            <button onClick={reset} className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white">Reset</button>
          </>
        }
      >
        This restores all candidates, jobs and notes to the original demo data. Your changes will be lost.
      </Modal>
    </div>
  );
}
