type Props = {
  /** Says where the button goes, e.g. "Back to Jobs"; read by screen readers and shown on hover. */
  label: string;
  onClick: () => void;
  size?: 'md' | 'sm';
};

/** The app's one back control: a round arrow icon, used on every child page (details, editors). */
export function BackButton({ label, onClick, size = 'md' }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`${size === 'sm' ? 'size-9' : 'size-10'} shrink-0 rounded-full bg-white dark:bg-dark-raised border border-line dark:border-dark-line flex items-center justify-center text-ink-muted hover:text-brand-vivid transition-colors shadow-sm`}
    >
      <span aria-hidden="true" className={`material-symbols-outlined ${size === 'sm' ? 'text-[20px]' : ''}`}>arrow_back</span>
    </button>
  );
}
