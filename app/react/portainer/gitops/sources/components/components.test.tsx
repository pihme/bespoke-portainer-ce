import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GitAuthentication } from './GitAuthentication';
import { IntervalField } from './IntervalField';
import { PasswordField } from './PasswordField';
import { PollingIntervalScopeTip } from './PollingIntervalScopeTip';
import { ProviderCredentialFields } from './ProviderCredentialFields';
import { UsernameField } from './UsernameField';

describe('gitops sources components', () => {
  it('renders IntervalField and forwards input changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<IntervalField value="5m" onChange={onChange} errors="bad" />);
    expect(screen.getByText('Fetch interval')).toBeVisible();
    const input = screen.getByTestId('repository-fetch-interval-input');
    await user.clear(input);
    await user.type(input, '10m');
    expect(onChange).toHaveBeenCalled();
  });

  it('renders UsernameField and PasswordField changes', async () => {
    const user = userEvent.setup();
    const onUser = vi.fn();
    const onPass = vi.fn();
    render(
      <>
        <UsernameField
          value="alice"
          onChange={onUser}
          tooltip="user tip"
          error="user err"
        />
        <PasswordField
          value="secret"
          onChange={onPass}
          label="Token"
          tooltip="pass tip"
          error="pass err"
          required
        />
      </>
    );
    expect(screen.getByTestId('component-gitUsernameInput')).toHaveValue(
      'alice'
    );
    expect(screen.getByTestId('component-gitPasswordInput')).toHaveValue(
      'secret'
    );
    await user.type(screen.getByTestId('component-gitUsernameInput'), 'x');
    await user.type(screen.getByTestId('component-gitPasswordInput'), 'y');
    expect(onUser).toHaveBeenCalled();
    expect(onPass).toHaveBeenCalled();
  });

  it('renders ProviderCredentialFields and propagates edits', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ProviderCredentialFields
        values={{ username: 'u', password: 'p' }}
        errors={{ username: 'u-err', password: 'p-err' }}
        onChange={onChange}
      />
    );
    await user.type(screen.getByTestId('component-gitUsernameInput'), 'a');
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ username: expect.any(String) })
    );
    await user.type(screen.getByTestId('component-gitPasswordInput'), 'b');
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ password: expect.any(String) })
    );
  });

  it('toggles GitAuthentication and shows credential fields when enabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <GitAuthentication
        values={{ authEnabled: false, username: '', password: '' }}
        onChange={onChange}
        toggleDataCy="git-auth-toggle"
      />
    );
    expect(
      screen.queryByTestId('component-gitUsernameInput')
    ).not.toBeInTheDocument();
    await user.click(screen.getByTestId('git-auth-toggle'));
    expect(onChange).toHaveBeenCalledWith({ authEnabled: true });

    rerender(
      <GitAuthentication
        values={{ authEnabled: true, username: 'u', password: 'p' }}
        errors={{ username: 'bad' }}
        isEditing
        onChange={onChange}
        toggleDataCy="git-auth-toggle"
      />
    );
    expect(screen.getByTestId('component-gitUsernameInput')).toBeVisible();
  });

  it('renders PollingIntervalScopeTip copy', () => {
    render(<PollingIntervalScopeTip />);
    expect(
      screen.getByText(/only applies to regular stacks/i)
    ).toBeVisible();
  });
});
