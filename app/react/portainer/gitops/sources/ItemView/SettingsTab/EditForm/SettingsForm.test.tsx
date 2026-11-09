import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { SourceDetail } from '../../../queries/useSource';

import { SettingsForm } from './SettingsForm';

const mutate = vi.fn();

vi.mock('../../../queries/useUpdateSourceMutation', () => ({
  useUpdateSourceMutation: () => ({
    mutate,
    isLoading: false,
  }),
}));

vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock('@@/form-components/usePreventFormExit', () => ({
  usePreventFormExit: () => undefined,
}));

vi.mock(
  '@/react/portainer/feature-flags/feature-flags.service',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('@/react/portainer/feature-flags/feature-flags.service')
    >()),
    isBE: false,
  })
);

const source: SourceDetail = {
  id: 8,
  name: 'editable-source',
  type: 'git',
  url: 'https://github.com/org/editable.git',
  status: 'healthy',
  connection: {
    tlsSkipVerify: false,
    authentication: { username: 'gituser' },
  },
  interval: '5m',
};

function renderForm(onCancel = vi.fn(), src: SourceDetail = source) {
  const Wrapped = withTestQueryProvider(() => (
    <SettingsForm source={src} onCancel={onCancel} />
  ));
  return { onCancel, ...render(<Wrapped />) };
}

describe('REQ-GIT-01 SettingsForm', () => {
  beforeEach(() => {
    mutate.mockReset();
  });

  it('TestREQ_GIT_01_loads_source_values_into_edit_form', () => {
    renderForm();

    expect(screen.getByTestId('source-name-input')).toHaveValue(
      'editable-source'
    );
    expect(screen.getByTestId('source-url-input')).toHaveValue(
      'https://github.com/org/editable.git'
    );
    expect(screen.getByTestId('cancel-settings-button')).toBeVisible();
    expect(screen.getByTestId('save-settings-button')).toBeDisabled();
  });

  it('TestREQ_GIT_01_cancels_edit_and_resets_form', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderForm();

    await user.clear(screen.getByTestId('source-name-input'));
    await user.type(screen.getByTestId('source-name-input'), 'changed');
    await user.click(screen.getByTestId('cancel-settings-button'));

    expect(onCancel).toHaveBeenCalled();
  });

  it('TestREQ_GIT_01_saves_changed_name_and_closes_editor', async () => {
    const user = userEvent.setup();
    const { notifySuccess } = await import(
      '@/portainer/services/notifications'
    );
    const onCancel = vi.fn();
    mutate.mockImplementation((_payload, opts) => {
      opts?.onSuccess?.();
      opts?.onSettled?.();
    });

    renderForm(onCancel);

    await user.clear(screen.getByTestId('source-name-input'));
    await user.type(screen.getByTestId('source-name-input'), 'renamed-source');

    await waitFor(() => {
      expect(screen.getByTestId('save-settings-button')).not.toBeDisabled();
    });

    await user.click(screen.getByTestId('save-settings-button'));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalled();
    });
    expect(mutate.mock.calls[0][0]).toEqual(
      expect.objectContaining({ name: 'renamed-source' })
    );
    expect(notifySuccess).toHaveBeenCalledWith('Source updated', '');
    expect(onCancel).toHaveBeenCalled();
  });

  it('TestREQ_GIT_01_defaults_missing_optional_source_fields', () => {
    const sparse: SourceDetail = {
      id: 9,
      name: undefined as unknown as string,
      type: 'git',
      url: undefined as unknown as string,
      status: 'healthy',
      connection: {},
    };
    renderForm(vi.fn(), sparse);

    expect(screen.getByTestId('source-name-input')).toHaveValue('');
    expect(screen.getByTestId('source-url-input')).toHaveValue('');
  });
});
