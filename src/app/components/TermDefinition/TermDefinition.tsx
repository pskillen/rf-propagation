/**
 * In-place term definitions (F8.4, [#66]) — `<TermDefinition
 * term="muf">MUF</TermDefinition>` renders its children inline with a
 * **touch-accessible** (tap/click, not hover-only — a direct F8.4
 * acceptance criterion, since this is a mobile-first product) affordance:
 * tap opens a popover with `TERM_DEFINITIONS[term].definition`, tap
 * elsewhere or press Escape closes it. Not a link to a glossary page, not
 * a tutorial step.
 *
 * Reusable enough that later surfaces get it for free (F8.4's own
 * acceptance criterion) — this component takes no Explore-specific
 * dependency, so Path's verdict table (phase 13, F10.2) can import it
 * directly for its own dB-margin/reliability column headers.
 *
 * [#66]: https://github.com/pskillen/rf-propagation/issues/66
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { TERM_DEFINITIONS, type TermKey } from '../../content/termDefinitions.ts';
import classes from './TermDefinition.module.css';

export interface TermDefinitionProps {
  term: TermKey;
  children: ReactNode;
}

export default function TermDefinition({ term, children }: TermDefinitionProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const entry = TERM_DEFINITIONS[term];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <span className={classes.root} ref={rootRef}>
      <button
        type="button"
        className={classes.trigger}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={`${entry.label} — show definition`}
      >
        {children}
      </button>
      {open ? (
        <span role="tooltip" className={classes.popover}>
          <strong className={classes.popoverLabel}>{entry.label}</strong>
          <span className={classes.popoverBody}>{entry.definition}</span>
        </span>
      ) : null}
    </span>
  );
}
