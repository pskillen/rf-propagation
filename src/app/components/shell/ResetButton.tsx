// Global reset-to-defaults (F7.2, phase 10's Slice 2) -- "always
// available" (F7.2's own AC), so this renders in AppChrome's header, next
// to the primary nav, not behind any surface-specific panel. All of the
// actual reset LOGIC lives in `App.tsx`'s `Shell` (it needs the shared
// clock, `ViewerState.setState`, the URL codec, and the router) -- this
// component is presentational only.
import { IconRefresh } from '@tabler/icons-react';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import { Button } from '../v2/index.ts';
import classes from './ResetButton.module.css';

export interface ResetButtonProps {
  onReset: () => void;
}

export default function ResetButton({ onReset }: ResetButtonProps) {
  return (
    <Button
      className={classes.root}
      variant="ghost"
      size="sm"
      aria-label="Reset to defaults"
      title="Reset to defaults"
      onClick={onReset}
    >
      <IconRefresh size={ICON_SIZE_ACTION} stroke={ICON_STROKE} aria-hidden />
    </Button>
  );
}
