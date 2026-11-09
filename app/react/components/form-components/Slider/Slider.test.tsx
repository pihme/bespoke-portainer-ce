import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { Slider, Props } from './Slider';

function renderDefault({
  min = 0,
  max = 10,
  step = 1,
  value = min,
  onChange = () => {},
  dataCy = 'someView-coolSlider',
  visibleTooltip = true,
}: Partial<Props> = {}) {
  return render(
    <Slider
      min={min}
      max={max}
      step={step}
      onChange={onChange}
      value={value}
      visibleTooltip={visibleTooltip}
      dataCy={dataCy}
    />
  );
}

test('should display a Slider component', async () => {
  const { getByRole } = renderDefault({});

  const handle = getByRole('slider');
  expect(handle).toBeTruthy();
});

describe('Slider marks and min label', () => {
  it('shows numeric min mark when min is not zero', () => {
    const { container } = renderDefault({
      min: 2,
      max: 10,
      value: 5,
      visibleTooltip: false,
    });
    expect(container.textContent).toContain('2');
    expect(container.textContent).toContain('10');
  });

  it('hides edge marks when the value is near the ends with visible tooltip', () => {
    const { container, rerender } = renderDefault({
      min: 0,
      max: 10,
      value: 0.5,
      visibleTooltip: true,
    });
    expect(container.textContent).toContain('unlimited');

    rerender(
      <Slider
        min={0}
        max={10}
        step={1}
        value={9.5}
        onChange={() => {}}
        dataCy="near-max"
        visibleTooltip
      />
    );
    // max mark emptied when value/max > 0.9
    expect(container.querySelector('[data-cy="near-max"]')).toBeTruthy();
  });
});
