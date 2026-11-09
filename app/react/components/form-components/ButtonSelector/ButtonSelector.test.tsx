import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ButtonSelector } from './ButtonSelector';

describe('ButtonSelector', () => {
  const options = [
    { value: 'bridge', label: 'Bridge' },
    { value: 'host', label: 'Host' },
    { value: 'none', disabled: true },
  ];

  it('renders options and calls onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ButtonSelector
        value="bridge"
        onChange={onChange}
        options={options}
        aria-label="network mode"
      />
    );
    expect(screen.getByText('Bridge')).toBeVisible();
    expect(screen.getByText('none')).toBeVisible();
    await user.click(screen.getByText('Host'));
    expect(onChange).toHaveBeenCalledWith('host');
  });

  it('disables all options when readOnly', () => {
    render(
      <ButtonSelector
        value="bridge"
        onChange={() => {}}
        options={options}
        readOnly
      />
    );
    const radios = screen.getAllByRole('radio');
    expect(radios.every((r) => (r as HTMLInputElement).disabled || (r as HTMLInputElement).readOnly)).toBe(true);
  });
});
