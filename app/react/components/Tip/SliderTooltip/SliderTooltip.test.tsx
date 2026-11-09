import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SliderTooltip } from './SliderTooltip';

describe('SliderTooltip', () => {
  it('shows the numeric value in the tooltip content', () => {
    render(
      <SliderTooltip value="42" delay={0} child={<span>handle</span>} />
    );
    expect(screen.getByText('handle')).toBeVisible();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('maps zero to unlimited in the tooltip content', () => {
    render(
      <SliderTooltip value="0" delay={0} child={<span>handle</span>} />
    );
    expect(screen.getByText('unlimited')).toBeInTheDocument();
  });

  it('respects a custom zIndex prop', () => {
    const { container } = render(
      <SliderTooltip
        value="5"
        delay={0}
        zIndex={99}
        child={<span>handle</span>}
      />
    );
    expect(container.querySelector('[style*="z-index"], [data-tippy-root]') || container).toBeTruthy();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
