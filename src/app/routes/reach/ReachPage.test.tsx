import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ViewerStateProvider } from '../../state/viewerState.tsx';
import ReachPage from './ReachPage.tsx';

beforeEach(() => {
  localStorage.clear();
});

describe('ReachPage', () => {
  it('renders the Reach map with the current station marker', async () => {
    const { container } = render(
      <ViewerStateProvider>
        <ReachPage />
      </ViewerStateProvider>,
    );

    expect(container.querySelector('.leaflet-container')).not.toBeNull();
    await waitFor(() => {
      expect(container.querySelector('.leaflet-marker-icon')).not.toBeNull();
    });
  });
});
