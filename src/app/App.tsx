import { useState } from 'react';
import BuildFooter from './components/BuildFooter/BuildFooter.tsx';
import { Button, Panel, Pill, TextInput } from './components/v2/index.ts';
import './App.css';

// Temporary kit-sample content, proving the v2 theme actually applies (not
// just that it compiles) — per phase 5 Slice 1. Slice 2 replaces this
// whole file with routing; this sample content moves into ReachPage.tsx.
export default function App() {
  const [callsign, setCallsign] = useState('');
  return (
    <div className="app-shell">
      <main className="app-placeholder">
        <h1>Propagation Viewer</h1>
        <p>Coming soon.</p>
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
      </main>
      <BuildFooter />
    </div>
  );
}
