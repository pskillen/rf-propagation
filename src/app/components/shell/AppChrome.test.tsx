// Confirms the transport control (F7.1, phase 10) "works on every
// surface, not only the globe" -- because `TransportControl` mounts in
// `AppChrome`'s own reserved slot, not inside any one surface's
// component tree (see `AppChrome.tsx`'s own doc comment), the chrome
// renders it identically no matter what `children` (i.e. which routed
// surface) is currently mounted. This is the fixture the plan file's
// Slice 1 asks for -- swapping `children` between stand-ins for
// Reach/Path/Timeline/Explore and asserting the transport-control slot's
// content is unaffected.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import AppChrome from './AppChrome.tsx';

function renderChrome(children: React.ReactNode) {
  render(
    <MemoryRouter>
      <AppChrome transportControl={<div data-testid="transport-control">Transport</div>}>
        {children}
      </AppChrome>
    </MemoryRouter>,
  );
}

describe('AppChrome transport-control slot', () => {
  it.each(['Reach surface', 'Path surface', 'Timeline surface', 'Explore surface'])(
    'renders the transport control regardless of the active surface (%s)',
    (surfaceLabel) => {
      renderChrome(<div>{surfaceLabel}</div>);
      expect(screen.getByTestId('transport-control')).toBeInTheDocument();
      expect(screen.getByText(surfaceLabel)).toBeInTheDocument();
    },
  );

  it('renders nothing in the slot when transportControl is omitted', () => {
    render(
      <MemoryRouter>
        <AppChrome>
          <div>Surface</div>
        </AppChrome>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('transport-control')).not.toBeInTheDocument();
  });
});
