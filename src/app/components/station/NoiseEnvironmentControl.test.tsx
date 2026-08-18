import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import NoiseEnvironmentControl from './NoiseEnvironmentControl.tsx';

beforeEach(() => {
  localStorage.clear();
});

describe('NoiseEnvironmentControl', () => {
  it('renders all four NoiseEnvironment literals as labelled options', () => {
    render(
      <DesignSystemV2Provider>
        <NoiseEnvironmentControl noiseEnvironment="rural" onStationChange={vi.fn()} />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByRole('button', { name: 'Quiet rural' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rural' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Residential' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Urban' })).toBeInTheDocument();
  });

  it('marks the current noiseEnvironment as pressed', () => {
    render(
      <DesignSystemV2Provider>
        <NoiseEnvironmentControl noiseEnvironment="urban" onStationChange={vi.fn()} />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByRole('button', { name: 'Urban' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Rural' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onStationChange with the selected noiseEnvironment', () => {
    const onStationChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <NoiseEnvironmentControl noiseEnvironment="rural" onStationChange={onStationChange} />
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Quiet rural' }));

    expect(onStationChange).toHaveBeenCalledTimes(1);
    expect(onStationChange.mock.calls[0][0].noiseEnvironment).toBe('quietRural');
  });
});
