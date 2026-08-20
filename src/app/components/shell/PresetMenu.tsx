// Preset starting points (F7.5, phase 10's Slice 5) -- a small menu,
// "always available" in the header alongside Reset/Share. "Loading one
// sets the inputs and gets out of the way -- no steps, no narration, no
// next button" (F7.5's own AC, and the anti-pattern the plan file
// explicitly names): each item is a plain `<a href>` built from
// `encodeViewerUrlState`, so selecting one is a real browser navigation
// -- the SAME "decode on mount" path a permalink uses (per PRESETS'
// own doc comment), not a second live-apply mechanism, and there is
// nothing here to "step through" -- the menu just closes (native <a>
// navigation) the instant one is clicked.
import { Menu } from '@mantine/core';
import { IconBookmarks } from '@tabler/icons-react';
import { encodeViewerUrlState } from '../../lib/urlState/codec.ts';
import { PRESETS } from '../../state/presets.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import { Button } from '../v2/index.ts';
import classes from './PresetMenu.module.css';

export default function PresetMenu() {
  return (
    <Menu position="bottom-end" withinPortal={false} transitionProps={{ duration: 0 }}>
      <Menu.Target>
        <Button
          className={classes.root}
          variant="ghost"
          size="sm"
          aria-label="Preset scenarios"
          title="Preset scenarios"
        >
          <IconBookmarks size={ICON_SIZE_ACTION} stroke={ICON_STROKE} aria-hidden />
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {PRESETS.map((preset) => (
          <Menu.Item
            key={preset.id}
            component="a"
            href={`/?${encodeViewerUrlState(preset.urlState).toString()}`}
            title={preset.groundedIn}
          >
            {preset.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
