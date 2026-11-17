import { toast } from '../../components/Toast';
import { CHANNEL_ICON, isChannel } from '../../domain/campaigns';
import type { Campaign, CampaignStatus } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import type { TKey } from '../../i18n/en';

export const PRIMARY_BTN =
  'px-6 py-2.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full font-bold shadow-lg shadow-orange-500/20 flex items-center gap-2 transition-all transform active:scale-95 text-sm shrink-0';
export const SECONDARY_BTN =
  'px-5 py-2.5 bg-white dark:bg-[#2a2423] border border-[#e6dddb] dark:border-[#3a3433] text-slate-700 dark:text-white text-sm font-bold rounded-full shadow-sm hover:border-primary/50 transition-colors flex items-center gap-2';

/** Display name for a stored channel id; unknown values (older saves) are shown as they are. */
export function useChannelLabel() {
  const t = useT();
  return (channel: string) => (isChannel(channel) ? t(`campaigns.channel.${channel}` as TKey) : channel);
}

export function ChannelIcons({ channels }: { channels: Campaign['channels'] }) {
  const label = useChannelLabel();
  return (
    <div className="flex gap-1.5 flex-wrap">
      {channels.map((ch) => (
        <span
          key={ch} title={label(ch)} aria-label={label(ch)} role="img"
          className="size-8 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-[18px]">{isChannel(ch) ? CHANNEL_ICON[ch] : 'link'}</span>
        </span>
      ))}
    </div>
  );
}

const STATUS_STYLE: Record<CampaignStatus, { pill: string; dot: string }> = {
  active: { pill: 'bg-[#ECFDF5] text-[#10B981]', dot: 'bg-[#10B981]' },
  paused: { pill: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' },
  ended: { pill: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const t = useT();
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.ended;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold ${s.pill}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`}></span>
      {t(`campaigns.status.${status}`)}
    </span>
  );
}

export function CopyButton({ url, label }: { url: string; label: string }) {
  const t = useT();
  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(url);
      toast(t('campaigns.copied'));
    } catch {
      toast(t('campaigns.copyFailed'), 'error');
    }
  };
  return (
    <button
      type="button" onClick={copy} aria-label={`${t('campaigns.copy')} ${label}`}
      className="shrink-0 px-3 py-1.5 border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-xs font-bold text-slate-700 dark:text-white hover:border-primary/50 transition-colors flex items-center gap-1.5"
    >
      <span className="material-symbols-outlined text-[16px]">content_copy</span>{t('campaigns.copy')}
    </button>
  );
}

/** One tracking link: channel icon and name, job, the URL and a copy button. */
export function LinkRow({ channel, jobTitle, url }: { channel: string; jobTitle: string; url: string }) {
  const label = useChannelLabel();
  return (
    <div className="flex items-center gap-3 py-3">
      <ChannelIcons channels={[channel]} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold text-slate-800 dark:text-gray-200">{label(channel)} · {jobTitle}</div>
        <div className="text-xs text-[#896a61] break-all">{url}</div>
      </div>
      <CopyButton url={url} label={`${label(channel)} ${jobTitle}`} />
    </div>
  );
}
