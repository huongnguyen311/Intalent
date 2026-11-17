import type { Prompt } from '../../domain/types';
import { useT } from '../../i18n/i18n';

const TH = 'px-6 py-4 text-xs font-bold text-[#896a61] uppercase tracking-wider border-b border-[#e6dddb] dark:border-[#2a2423]  ';

/** Stable pseudo-usage per prompt id: the demo calls no model, so these figures are simulated. */
function usageFor(p: Prompt) {
  let h = 7;
  for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const calls = 120 + (h % 880);
  const tokens = calls * (900 + (h % 700));
  return { calls, tokens, cost: (tokens / 1_000_000) * 3 };
}

export function UsageTab({ prompts }: { prompts: Prompt[] }) {
  const t = useT();
  const rows = prompts.map((p) => ({ p, ...usageFor(p) }));
  const sum = rows.reduce((s, r) => ({ calls: s.calls + r.calls, tokens: s.tokens + r.tokens, cost: s.cost + r.cost }), { calls: 0, tokens: 0, cost: 0 });
  const cards: Array<[string, string]> = [
    [t('systemConfig.usage.calls'), sum.calls.toLocaleString('en-US')],
    [t('systemConfig.usage.tokens'), sum.tokens.toLocaleString('en-US')],
    [t('systemConfig.usage.cost'), `$${sum.cost.toFixed(2)}`],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('systemConfig.usage.title')}</h2>
        <p className="text-sm text-gray-500">{t('systemConfig.usage.desc')}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map(([label, value]) => (
          <div key={label} className="bg-white dark:bg-[#1e1e1e] p-4 rounded-xl border border-[#e6dddb] dark:border-[#2a2423] shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
            <span className="text-3xl font-bold text-gray-900 dark:text-white">{value}</span>
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-[#1e1e1e] rounded-xl border border-[#e6dddb] dark:border-[#2a2423] shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#f8f6f6] dark:bg-[#251f1e]">
            <tr>
              {(['systemConfig.col.key', 'systemConfig.usage.calls', 'systemConfig.usage.tokens', 'systemConfig.usage.cost'] as const).map((k) => (
                <th key={k} className={TH}>{t(k)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f4f1f0] dark:divide-[#2a2423]">
            {rows.map((r) => (
              <tr key={r.p.id}>
                <td className="px-6 py-4 whitespace-nowrap font-medium">{r.p.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{r.calls.toLocaleString('en-US')}</td>
                <td className="px-6 py-4 whitespace-nowrap">{r.tokens.toLocaleString('en-US')}</td>
                <td className="px-6 py-4 whitespace-nowrap">${r.cost.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[#896a61]">{t('systemConfig.usage.note')}</p>
    </div>
  );
}
