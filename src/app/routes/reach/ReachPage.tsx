import { useState } from 'react';
import { Button, Panel, Pill, TextInput } from '../../components/v2/index.ts';
import SurfaceLayout from '../../components/layout/SurfaceLayout.tsx';

// Temporary kit-sample content, proving the v2 theme actually applies (not
// just that it compiles) — carried over from phase 5 Slice 1's App.tsx.
// A later phase (8) replaces this placeholder with the real Reach surface.
function KitSample() {
  const [callsign, setCallsign] = useState('');
  return (
    <Panel title="Kit sample" sub="Proves the v2 dark theme is actually applied">
      <TextInput
        label="Callsign"
        placeholder="e.g. GM4ABC"
        value={callsign}
        onChange={(e) => setCallsign(e.currentTarget.value)}
      />
      <Pill tone="accent">v2 kit</Pill>
      <Button variant="primary">Sample button</Button>
    </Panel>
  );
}

export default function ReachPage() {
  return (
    <SurfaceLayout
      controls={<KitSample />}
      canvas={<p>Reach — coverage surface arrives in phase 8.</p>}
    />
  );
}
