import { Link } from 'react-router-dom';

type Props = {
  /** What happened, in one sentence. */
  message: string;
  /** Where to go instead. */
  backTo: string;
  backLabel: string;
  /** `lock`: the item exists but this user may not open it; `search_off`: it does not exist. */
  icon?: 'lock' | 'search_off';
};

/** Replaces a bare "not found" line: says what happened and always offers a way back. */
export function NotFoundState({ message, backTo, backLabel, icon = 'search_off' }: Props) {
  return (
    <div className="p-8 flex flex-col items-center text-center gap-3 mt-8">
      <span aria-hidden="true" className="size-14 rounded-full bg-orange-50 dark:bg-white/5 text-primary grid place-items-center">
        <span className="material-symbols-outlined text-[28px]">{icon}</span>
      </span>
      <p className="text-sm text-[#896a61] max-w-md">{message}</p>
      <Link to={backTo} className="h-10 px-5 rounded-full bg-primary text-white text-sm font-bold inline-flex items-center gap-1.5 hover:bg-primary-hover">
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">arrow_back</span>
        {backLabel}
      </Link>
    </div>
  );
}
