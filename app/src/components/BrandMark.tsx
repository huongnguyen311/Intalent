/** InTalent logo mark (orange "V" figure, transparent background) — reads on both the dark sidebar and light headers. */
export function BrandMark({ className = 'h-8' }: { className?: string }) {
  return <img src="/assets/images/intalent-mark.png" alt="" aria-hidden="true" className={`${className} w-auto shrink-0 select-none`} draggable={false} />;
}
