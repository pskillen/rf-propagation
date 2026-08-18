// Permalink / share affordance (F7.4, phase 10's Slice 4) — "always
// available," same header placement as `ResetButton`. Builds a full URL
// from `encodeViewerUrlState(viewerStateToUrlState(state))` and copies it
// via `navigator.clipboard.writeText`, with a brief "Link copied"
// confirmation (this button's own label swaps for ~2s rather than a
// separate toast component, which doesn't exist yet in this kit).
import { useState } from 'react';
import { IconCheck, IconShare } from '@tabler/icons-react';
import { encodeViewerUrlState } from '../../lib/urlState/codec.ts';
import { viewerStateToUrlState } from '../../lib/urlState/fromViewerState.ts';
import { useViewerState } from '../../state/viewerState.tsx';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import { Button } from '../v2/index.ts';
import classes from './ShareButton.module.css';

const COPIED_LABEL_MS = 2000;

export default function ShareButton() {
  const { state } = useViewerState();
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const params = encodeViewerUrlState(viewerStateToUrlState(state));
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_LABEL_MS);
    } catch {
      // Clipboard access denied/unavailable -- no confirmation, but also
      // no crash; the operator can still copy the address bar manually.
    }
  }

  return (
    <Button
      className={classes.root}
      variant="ghost"
      size="sm"
      aria-label={copied ? 'Link copied' : 'Copy share link'}
      title={copied ? 'Link copied' : 'Copy share link'}
      onClick={handleShare}
    >
      {copied ? (
        <IconCheck size={ICON_SIZE_ACTION} stroke={ICON_STROKE} aria-hidden />
      ) : (
        <IconShare size={ICON_SIZE_ACTION} stroke={ICON_STROKE} aria-hidden />
      )}
    </Button>
  );
}
