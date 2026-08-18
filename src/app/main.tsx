import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@mantine/core/styles.css';
import { DesignSystemV2Provider } from './components/v2/index.ts';
import App from './App.tsx';

// This app has no v1 — every surface uses the v2 kit — so
// DesignSystemV2Provider is mounted once, at the true root, rather than
// nested inside a base MantineProvider per page as Studio does (Studio
// keeps v1 and v2 pages coexisting; this app doesn't). See phase 5's plan
// file ("Current state") for the full rationale.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DesignSystemV2Provider>
      <App />
    </DesignSystemV2Provider>
  </StrictMode>,
);
