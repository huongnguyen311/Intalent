import { useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { Modal } from '../../components/Modal';
import { MenuItem, Popover } from '../../components/Popover';
import { toast } from '../../components/Toast';
import { isFixtureMode } from '../../data/fixtureMockup';
import type { TaxonomyItem } from '../../domain/types';
import { useT, type TKey } from '../../i18n/i18n';
import { useStore } from '../../store/store';

type Kind = TaxonomyItem['kind'];
type Sort = 'newest' | 'oldest' | 'name';
type StatusFilter = '' | 'active' | 'inactive';

const KINDS: Array<{ kind: Kind; tab: TKey; add: TKey; search: TKey }> = [
  { kind: 'english', tab: 'taxonomy.tab.english', add: 'taxonomy.add.english', search: 'taxonomy.search.english' },
  { kind: 'domain', tab: 'taxonomy.tab.domain', add: 'taxonomy.add.domain', search: 'taxonomy.search.domain' },
  { kind: 'seniority', tab: 'taxonomy.tab.seniority', add: 'taxonomy.add.seniority', search: 'taxonomy.search.seniority' },
];
const SORTS: Array<[Sort, TKey]> = [['newest', 'taxonomy.sort.newest'], ['oldest', 'taxonomy.sort.oldest'], ['name', 'taxonomy.sort.name']];
const STATUSES: Array<[StatusFilter, TKey]> = [['', 'taxonomy.filter.all'], ['active', 'taxonomy.filter.active'], ['inactive', 'taxonomy.filter.inactive']];

const TAB_ON = 'px-4 py-3 text-sm font-semibold relative text-primary border-b-2 border-primary';
const TAB_OFF = 'px-4 py-3 text-sm font-semibold relative text-[#5a4a46] dark:text-gray-400 hover:text-[#181211] dark:hover:text-gray-200 transition-colors';
const FILTER_BTN =
  'flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-sm font-medium text-[#181211] dark:text-white hover:border-primary/50 transition-colors whitespace-nowrap ';
const TH = 'px-6 py-4 text-xs font-bold text-[#896a61] uppercase tracking-wider border-b border-[#e6dddb] dark:border-[#2a2423]  ';
const CHECK = 'rounded border-gray-300 text-primary focus:ring-primary dark:bg-[#1e1e1e] dark:border-[#3a3433]';
const PRIMARY_BTN = 'px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-semibold text-sm transition-colors';
const FIELD = 'w-full px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] focus:border-primary focus:ring-0 rounded-lg text-sm text-[#181211] dark:text-white';

/** "2026-02-24" -> "2/24/2026" (read from the date part, so no timezone shift). */
const mdy = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${Number(m)}/${Number(d)}/${y}`;
};

function FilterButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={FILTER_BTN}>
      <span className="material-symbols-outlined text-[18px] text-[#896a61]">{icon}</span>
      <span>{label}</span>
      <span className="material-symbols-outlined text-[18px] text-[#896a61]">expand_more</span>
    </button>
  );
}

function LabelDialog({ title, initial, onSave, onClose }: { title: string; initial: string; onSave: (label: string) => TKey | null; onClose: () => void }) {
  const t = useT();
  const [label, setLabel] = useState(initial);
  const [error, setError] = useState<TKey | null>(null);
  const submit = () => {
    const err = onSave(label);
    if (err) setError(err);
    else onClose();
  };
  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#5a4a46] hover:text-[#181211]">{t('common.cancel')}</button>
          <button onClick={submit} className={PRIMARY_BTN}>{t('taxonomy.save')}</button>
        </>
      }
    >
      <label className="block text-xs font-bold text-[#896a61] uppercase tracking-wider mb-1" htmlFor="taxonomy-label">{t('taxonomy.col.name')}</label>
      <input
        id="taxonomy-label"
        autoFocus
        className={FIELD}
        value={label}
        onChange={(e) => { setLabel(e.target.value); setError(null); }}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{t(error)}</p>}
    </Modal>
  );
}

export function TaxonomyPage() {
  const t = useT();
  const taxonomy = useStore((s) => s.taxonomy);
  const candidates = useStore((s) => s.candidates);
  const { addTaxonomy, renameTaxonomy, setTaxonomyActive } = useStore.getState();
  const fixture = isFixtureMode();
  const [kind, setKind] = useState<Kind>('english');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [sort, setSort] = useState<Sort>('newest');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<{ item?: TaxonomyItem } | null>(null);
  const cfg = KINDS.find((k) => k.kind === kind)!;

  // Usage is how many candidates carry the label; the mockup shows the stored figure (0) instead.
  const usage = (i: TaxonomyItem) =>
    fixture
      ? i.usage
      : candidates.filter((c) => (i.kind === 'english' ? c.english === i.label : i.kind === 'seniority' ? c.seniority === i.label : c.domains.includes(i.label))).length;

  const rows = taxonomy
    .filter((i) => i.kind === kind && (!q.trim() || i.label.toLowerCase().includes(q.trim().toLowerCase())) && (!status || i.active === (status === 'active')))
    .sort((a, b) =>
      sort === 'name' ? a.label.localeCompare(b.label)
        : sort === 'oldest' ? a.updatedAt.localeCompare(b.updatedAt)
          : b.updatedAt.localeCompare(a.updatedAt),
    );
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));

  const save = (label: string): TKey | null => {
    const renaming = dialog?.item;
    const res = renaming ? renameTaxonomy(renaming.id, label) : addTaxonomy(kind, label);
    if (!res.ok) return res.reason === 'duplicate' ? 'taxonomy.err.duplicate' : 'taxonomy.err.empty';
    toast(t(renaming ? 'taxonomy.renamed' : 'taxonomy.added'));
    return null;
  };

  return (
    <AppLayout title={t('taxonomy.title')} subtitle={t('taxonomy.subtitle')}>
      <div className="p-8 max-w-[1400px] mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-end gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setDialog({})} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-semibold text-sm transition-colors shadow-md shadow-orange-900/20">
              <span className="material-symbols-outlined text-[20px]">add</span>{t(cfg.add)}
            </button>
          </div>
        </div>
        <div className="flex border-b border-[#e6dddb] dark:border-[#2a2423] gap-1">
          {KINDS.map((k) => (
            <button key={k.kind} onClick={() => { setKind(k.kind); setSelected(new Set()); }} className={k.kind === kind ? TAB_ON : TAB_OFF}>{t(k.tab)}</button>
          ))}
        </div>
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#896a61] material-symbols-outlined text-[20px]">search</span>
            <input
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] focus:border-primary focus:ring-0 rounded-lg text-sm text-[#181211] dark:text-white transition-all placeholder-[#896a61]"
              placeholder={t(cfg.search)}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Popover trigger={({ toggle: tg }) => <FilterButton icon="filter_list" label={t('taxonomy.filter.label', { value: t(STATUSES.find(([v]) => v === status)![1]) })} onClick={tg} />}>
              {(close) => STATUSES.map(([v, key]) => <MenuItem key={v} active={v === status} onClick={() => { setStatus(v); close(); }}>{t(key)}</MenuItem>)}
            </Popover>
            <Popover trigger={({ toggle: tg }) => <FilterButton icon="sort" label={t('taxonomy.sort.label', { value: t(SORTS.find(([v]) => v === sort)![1]) })} onClick={tg} />}>
              {(close) => SORTS.map(([v, key]) => <MenuItem key={v} active={v === sort} onClick={() => { setSort(v); close(); }}>{t(key)}</MenuItem>)}
            </Popover>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1e1e1e] rounded-xl border border-[#e6dddb] dark:border-[#2a2423] shadow-sm flex flex-col border-0 shadow-sm">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#f8f6f6] dark:bg-[#251f1e] sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 w-12 border-b border-[#e6dddb] dark:border-[#2a2423]">
                    <div className="flex items-center"><input aria-label={t('taxonomy.selectAll')} className={CHECK} type="checkbox" checked={allSelected} onChange={toggleAll} /></div>
                  </th>
                  {(['taxonomy.col.name', 'taxonomy.col.usage', 'taxonomy.col.status', 'taxonomy.col.modified'] as const).map((k) => (
                    <th key={k} className={TH}><div className="flex items-center gap-1">{t(k)}</div></th>
                  ))}
                  <th className="px-6 py-4 w-16 border-b border-[#e6dddb] dark:border-[#2a2423] text-xs font-bold text-[#896a61] uppercase tracking-wider text-center">{t('taxonomy.col.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f1f0] dark:divide-[#2a2423]">
                {rows.map((i) => (
                  <tr key={i.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group ">
                    <td className="px-6 py-4 whitespace-nowrap"><input className={CHECK} type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} /></td>
                    <td className="px-6 py-4 whitespace-nowrap "><span className="font-semibold text-sm text-[#181211] dark:text-white">{i.label}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap "><span className="text-sm text-[#5a4a46] dark:text-gray-400">{usage(i)}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap ">
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${i.active ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                        <span className="text-sm font-medium text-[#181211] dark:text-white">{t(i.active ? 'taxonomy.active' : 'taxonomy.inactive')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap "><span className="text-sm text-[#896a61]">{mdy(i.updatedAt)}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <Popover
                        align="right"
                        trigger={({ toggle: tg }) => (
                          <button aria-label={t('taxonomy.col.actions')} onClick={tg} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-slate-900 dark:hover:text-white">
                            <span className="material-symbols-outlined">more_horiz</span>
                          </button>
                        )}
                      >
                        {(close) => (
                          <>
                            <MenuItem onClick={() => { close(); setDialog({ item: i }); }}>{t('taxonomy.menu.rename')}</MenuItem>
                            <MenuItem onClick={() => { close(); setTaxonomyActive(i.id, !i.active); toast(t(i.active ? 'taxonomy.deactivated' : 'taxonomy.activated')); }}>
                              {t(i.active ? 'taxonomy.menu.deactivate' : 'taxonomy.menu.activate')}
                            </MenuItem>
                          </>
                        )}
                      </Popover>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-[#896a61]">{t('taxonomy.empty')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {dialog && (
        <LabelDialog
          key={dialog.item?.id ?? 'new'}
          title={dialog.item ? t('taxonomy.rename.title') : t(cfg.add)}
          initial={dialog.item?.label ?? ''}
          onSave={save}
          onClose={() => setDialog(null)}
        />
      )}
    </AppLayout>
  );
}
