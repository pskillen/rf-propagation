import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TERM_DEFINITIONS, type TermKey } from '../../content/termDefinitions.ts';
import TermDefinition from './TermDefinition.tsx';

const ALL_TERM_KEYS = Object.keys(TERM_DEFINITIONS) as TermKey[];

describe('TERM_DEFINITIONS', () => {
  it.each(ALL_TERM_KEYS)('has a non-empty label and definition for %s', (key) => {
    expect(TERM_DEFINITIONS[key].label.trim().length).toBeGreaterThan(0);
    expect(TERM_DEFINITIONS[key].definition.trim().length).toBeGreaterThan(0);
  });
});

describe('TermDefinition', () => {
  it('renders its children inline, popover closed by default', () => {
    const { getByText, queryByRole } = render(<TermDefinition term="muf">MUF</TermDefinition>);
    expect(getByText('MUF')).toBeInTheDocument();
    expect(queryByRole('tooltip')).toBeNull();
  });

  it('opens the popover on click/tap', () => {
    const { getByText, getByRole } = render(<TermDefinition term="muf">MUF</TermDefinition>);
    fireEvent.click(getByText('MUF'));
    expect(getByRole('tooltip')).toHaveTextContent(TERM_DEFINITIONS.muf.definition);
  });

  it('closes on outside pointerdown', () => {
    const { getByText, queryByRole } = render(
      <div>
        <TermDefinition term="muf">MUF</TermDefinition>
        <span data-testid="outside">elsewhere</span>
      </div>,
    );
    fireEvent.click(getByText('MUF'));
    expect(queryByRole('tooltip')).not.toBeNull();
    fireEvent.pointerDown(document.body);
    expect(queryByRole('tooltip')).toBeNull();
  });

  it('closes on Escape', () => {
    const { getByText, queryByRole } = render(<TermDefinition term="muf">MUF</TermDefinition>);
    fireEvent.click(getByText('MUF'));
    expect(queryByRole('tooltip')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(queryByRole('tooltip')).toBeNull();
  });
});
