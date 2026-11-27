import { useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { Modal } from '../../components/Modal';
import { MenuItem, Popover } from '../../components/Popover';
import { toast } from '../../components/Toast';
import { isFixtureMode } from '../../data/fixtureMockup';
import type { TaxonomyItem } from '../../domain/types';
import { useT, type TKey } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { BTN_PRIMARY as PRIMARY_BTN, FIELD } from '../../components/ui';

type Kind = TaxonomyItem['kind'];
type Sort = 'newest' | 'oldest' | 'name';
type StatusFilter = '' | 'active' | 'inactive';

const TAB_ICON: Record<Kind, string> = { english: 'translate', domain: 'category', seniority: 'stairs' };
const KINDS: Array<{ kind: Kind; tab: TKey; add: TKey; search: TKey }> = [
  { kind: 'english', tab: 'taxonomy.tab.english', add: 'taxonomy.add.english', search: 'taxonomy.search.english' },
  { kind: 'domain', tab: 'taxonomy.tab.domain', add: 'taxonomy.add.domain', search: 'taxonomy.search.domain' },
  { kind: 'seniority', tab: 'taxonomy.tab.seniority', add: 'taxonomy.add.seniority', search: 'taxonomy.search.seniority' },
];
const SORTS: Array<[Sort, TKey]> = [['newest', 'taxonomy.sort.newest'], ['oldest', 'taxonomy.sort.oldest'], ['name', 'taxonomy.sort.name']];
const STATUSES: Array<[StatusFilter, TKey]> = [['', 'taxonomy.filter.all'], ['active', 'taxonomy.filter.active'], ['inactive', 'taxonomy.filter.inactive']];

const TAB_ON = 'ui-tab -mb-px px-3 py-2.5 text-sm font-semibold text-primary border-b-2 border-primary';
const TAB_OFF = 'ui-tab -mb-px px-3 py-2.5 text-sm font-semibold border-b-2 border-transparent text-gray-600 dark:text-gray-400 hover:text-ink dark:hover:text-gray-200 transition-colors';
const FILTER_BTN =
  'flex items-center gap-1.5 h-9 px-3 bg-white dark:bg-dark-surface border border-line dark:border-dark-line rounded-lg text-sm font-medium text-ink dark:text-white hover:border-primary/50 transition-colors whitespace-nowrap';
const TH = 'px-4 py-2.5 text-xs font-bold text-ink-muted uppercase tracking-wider border-b border-line dark:border-dark-raised whitespace-nowrap';
const TD = 'px-4 py-2.5 whitespace-nowrap';
const CHECK = 'rounded border-gray-300 text-primary focus:ring-primary dark:bg-dark-surface dark:border-dark-line';

/** "2026-02-24" -> "2/24/2026" (read from the date part, so no timezone shift). */
const mdy = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${Number(m)}/${Number(d)}/${y}`;
};

function FilterButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={FILTER_BTN}>
      <span className="material-symbols-outlined text-[18px] text-ink-muted">{icon}</span>
      <span>{label}</span>
      <span className="material-symbols-outlined text-[18px] text-ink-muted -mr-1">expand_more</span>
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
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-ink">{t('common.cancel')}</button>
          <button onClick={submit} className={PRIMARY_BTN}>{t('taxonomy.save')}</button>
        </>
      }
    >
      <label className="block text-xs font-bold text-ink-muted uppercase tracking-wider mb-1" htmlFor="taxonomy-label">{t('taxonomy.col.name')}</label>
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
      <div className={`${fixture ? 'px-6 py-5' : 'p-8'} max-w-[1400px] mx-auto space-y-4`}>
        <div role="tablist" className="ui-tabs flex border-b border-line dark:border-dark-raised gap-1">
          {KINDS.map((k) => (
            <button key={k.kind} role="tab" aria-selected={k.kind === kind} onClick={() => { setKind(k.kind); setSelected(new Set()); }} className={k.kind === kind ? TAB_ON : TAB_OFF}>{!fixture && <span aria-hidden="true" className="material-symbols-outlined">{TAB_ICON[k.kind]}</span>}{t(k.tab)}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative w-full sm:w-80">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted material-symbols-outlined text-[18px]">search</span>
            <input
              className="w-full h-9 pl-9 pr-3 bg-white dark:bg-dark-surface border border-line dark:border-dark-line focus:border-primary focus:ring-0 rounded-lg text-sm text-ink dark:text-white transition-all placeholder-ink-muted"
              placeholder={t(cfg.search)}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Popover trigger={({ toggle: tg }) => <FilterButton icon="filter_list" label={t('taxonomy.filter.label', { value: t(STATUSES.find(([v]) => v === status)![1]) })} onClick={tg} />}>
              {(close) => STATUSES.map(([v, key]) => <MenuItem key={v} active={v === status} onClick={() => { setStatus(v); close(); }}>{t(key)}</MenuItem>)}
            </Popover>
            <Popover trigger={({ toggle: tg }) => <FilterButton icon="sort" label={t('taxonomy.sort.label', { value: t(SORTS.find(([v]) => v === sort)![1]) })} onClick={tg} />}>
              {(close) => SORTS.map(([v, key]) => <MenuItem key={v} active={v === sort} onClick={() => { setSort(v); close(); }}>{t(key)}</MenuItem>)}
            </Popover>
          </div>
          <button onClick={() => setDialog({})} className="ml-auto flex items-center gap-1.5 h-9 pl-3 pr-4 bg-primary hover:bg-primary-hover text-white rounded-lg font-semibold text-sm transition-colors">
            <span className="material-symbols-outlined text-[18px]">add</span>{t(cfg.add)}
          </button>
        </div>
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-line dark:border-dark-raised shadow-sm overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-220px)] custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="bg-background-light dark:bg-dark-surface sticky top-0 z-10">
                <tr>
                  <th className={`${TH} w-10 pr-0`}>
                    <input aria-label={t('taxonomy.selectAll')} className={`${CHECK} align-middle`} type="checkbox" checked={allSelected} onChange={toggleAll} />
                  </th>
                  <th className={TH}>{t('taxonomy.col.name')}</th>
                  <th className={`${TH} w-28 text-right`}>{t('taxonomy.col.usage')}</th>
                  <th className={`${TH} w-36`}>{t('taxonomy.col.status')}</th>
                  <th className={`${TH} w-36`}>{t('taxonomy.col.modified')}</th>
                  <th className={`${TH} w-16 text-center`}>{t('taxonomy.col.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline dark:divide-dark-raised">
                {rows.map((i) => (
                  <tr key={i.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <td className={`${TD} pr-0`}><input className={`${CHECK} align-middle`} type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} /></td>
                    <td className={TD}><span className="font-semibold text-sm text-ink dark:text-white">{i.label}</span></td>
                    <td className={`${TD} text-right tabular-nums`}><span className="text-sm text-gray-600 dark:text-gray-400">{usage(i)}</span></td>
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${i.active ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                        <span className="text-sm font-medium text-ink dark:text-white">{t(i.active ? 'taxonomy.active' : 'taxonomy.inactive')}</span>
                      </div>
                    </td>
                    <td className={TD}><span className="text-sm text-ink-muted tabular-nums">{mdy(i.updatedAt)}</span></td>
                    <td className={`${TD} py-1 text-center`}>
                      <Popover
                        align="right"
                        trigger={({ toggle: tg }) => (
                          <button aria-label={t('taxonomy.col.actions')} onClick={tg} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-muted dark:text-gray-400 hover:text-slate-900 dark:hover:text-white">
                            <span className="material-symbols-outlined text-[20px] block">more_horiz</span>
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
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-muted">{t('taxonomy.empty')}</td></tr>
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
