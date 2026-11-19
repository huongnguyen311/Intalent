import { textBlocks } from '../../domain/jdWriter';

/** One job-post section: a heading, then the text as paragraphs and check-mark bullet lists. */
export function PostSection({ heading, text, headingClass }: { heading: string; text: string; headingClass: string }) {
  return (
    <section>
      <h2 className={headingClass}>{heading}</h2>
      <div className="space-y-3">
        {textBlocks(text).map((b, i) =>
          b.kind === 'p' ? (
            <p key={i}>{b.text}</p>
          ) : (
            <ul key={i} className="space-y-2">
              {b.items.map((item, j) => (
                <li key={j} className="flex gap-2.5">
                  <span className="material-symbols-outlined icon-filled text-primary text-[20px] mt-0.5">check_circle</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ),
        )}
      </div>
    </section>
  );
}
