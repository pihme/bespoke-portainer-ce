import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { UserViewModel } from '@/portainer/models/user';

const mutate = vi.fn();
const applyTheme = vi.fn();

vi.mock('@/react/portainer/account/useUpdateUserMutation', () => ({
  useUpdateUserMutation: () => ({ mutate }),
}));

vi.mock('@/react/portainer/services/applyTheme', () => ({
  applyTheme: (...args: unknown[]) => applyTheme(...args),
}));

import { ThemeSelector } from './UserMenuThemeSelector';

describe('ThemeSelector', () => {
  it('applies and persists the selected theme', async () => {
    const user = userEvent.setup();
    const account = new UserViewModel({
      Username: 'admin',
      ThemeSettings: { color: 'light' },
    });
    render(<ThemeSelector user={account} />);
    await user.click(screen.getByLabelText('Dark Theme'));
    expect(applyTheme).toHaveBeenCalledWith('dark');
    expect(mutate).toHaveBeenCalledWith({ theme: { color: 'dark' } });
  });
});
