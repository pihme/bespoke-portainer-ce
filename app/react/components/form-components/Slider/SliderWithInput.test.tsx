import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SliderWithInput } from './SliderWithInput';

const sliderOnChange = vi.fn();

vi.mock('./Slider', () => ({
  Slider: ({
    onChange,
    dataCy,
  }: {
    onChange: (v: number | number[]) => void;
    dataCy: string;
  }) => {
    sliderOnChange.mockImplementation(onChange);
    return (
      <button
        type="button"
        data-cy={dataCy}
        onClick={() => onChange([4, 5])}
      >
        mock-slider
      </button>
    );
  },
}));

describe('SliderWithInput', () => {
  it('renders slider and number input and forwards input changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SliderWithInput
        value={2}
        onChange={onChange}
        max={10}
        min={0}
        dataCy="cpu"
        inputId="cpu-input"
      />
    );
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveAttribute('id', 'cpu-input');
    await user.clear(input);
    await user.type(input, '5');
    expect(onChange).toHaveBeenCalled();
  });

  it('omits the slider when max is falsy', () => {
    render(
      <SliderWithInput value={0} onChange={() => {}} max={0} dataCy="x" />
    );
    expect(screen.queryByTestId('xSlider')).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toBeVisible();
  });

  it('forwards slider number-array changes as the first value', () => {
    const onChange = vi.fn();
    render(
      <SliderWithInput value={3} onChange={onChange} max={10} dataCy="mem" />
    );
    screen.getByText('mock-slider').click();
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
