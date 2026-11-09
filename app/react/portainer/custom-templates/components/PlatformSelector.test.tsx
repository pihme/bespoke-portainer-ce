import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Platform } from '../../templates/types';

import { PlatformField } from './PlatformSelector';

describe('PlatformField', () => {
  it('renders Linux/Windows options and reports changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PlatformField value={Platform.LINUX} onChange={onChange} />);
    expect(screen.getByLabelText(/Platform/i)).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox'), String(Platform.WINDOWS));
    expect(onChange).toHaveBeenCalledWith(Platform.WINDOWS);
  });
});
