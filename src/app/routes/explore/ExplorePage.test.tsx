import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import DesignSystemV2Provider from '../../components/v2/DesignSystemV2Provider.tsx';
import { ViewerStateProvider } from '../../state/viewerState.tsx';
import ExplorePage from './ExplorePage.tsx';

beforeEach(() => {
  localStorage.clear();
});

function renderExplorePage() {
  return render(
    <ViewerStateProvider>
      <DesignSystemV2Provider>
        <ExplorePage />
      </DesignSystemV2Provider>
    </ViewerStateProvider>,
  );
}

describe('ExplorePage', () => {
  it('renders the cross-section view by default, with ray overlay controls', () => {
    renderExplorePage();
    expect(screen.getByLabelText(/vertical cross-section/i)).toBeInTheDocument();
    expect(screen.getByText('Ray overlay')).toBeInTheDocument();
    expect(screen.getByText('Radials')).toBeInTheDocument();
  });

  it('does not render the link-budget breakdown when no target is set', () => {
    renderExplorePage();
    expect(screen.queryByText('Link budget')).toBeNull();
  });
});
