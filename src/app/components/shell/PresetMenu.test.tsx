import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import { encodeViewerUrlState } from '../../lib/urlState/codec.ts';
import { PRESETS } from '../../state/presets.ts';
import PresetMenu from './PresetMenu.tsx';

function renderMenu() {
  return render(
    <DesignSystemV2Provider>
      <PresetMenu />
    </DesignSystemV2Provider>,
  );
}

function menuItemLinks(container: HTMLElement): HTMLAnchorElement[] {
  return Array.from(container.querySelectorAll('a[role="menuitem"]'));
}

describe('PresetMenu', () => {
  it('lists every preset, closed by default', () => {
    const { container } = renderMenu();
    expect(menuItemLinks(container)).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Preset scenarios' })).toBeInTheDocument();
  });

  it('opens to reveal every preset by label, each a plain link (no next/step affordance)', async () => {
    const { container } = renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Preset scenarios' }));

    await waitFor(() => expect(menuItemLinks(container)).toHaveLength(PRESETS.length));
    const links = menuItemLinks(container);
    expect(links.map((link) => link.textContent)).toEqual(PRESETS.map((p) => p.label));
    expect(screen.queryByText(/next/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/step \d/i)).not.toBeInTheDocument();
  });

  it("each preset's href is exactly its own encoded permalink query string", async () => {
    const { container } = renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Preset scenarios' }));

    await waitFor(() => expect(menuItemLinks(container)).toHaveLength(PRESETS.length));
    const links = menuItemLinks(container);
    PRESETS.forEach((preset, index) => {
      const expectedQuery = encodeViewerUrlState(preset.urlState).toString();
      expect(links[index].getAttribute('href')).toBe(`/?${expectedQuery}`);
    });
  });
});
