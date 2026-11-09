import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { number, object } from 'yup';
import { vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { createMockUser } from '@/react-tools/test-mocks';
import { server } from '@/setup-tests/server';

import { EditResourcesForm } from './EditResourceForm';

const mockNotifySuccess = vi.fn();
const mockInvalidate = vi.fn();
const redeploy = vi.fn();

vi.mock('@uirouter/react', async (importOriginal: () => Promise<object>) => ({
  ...(await importOriginal()),
  useCurrentStateAndParams: () => ({
    params: { from: 'container-1', endpointId: 1 },
  }),
}));

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

vi.mock('@/react/docker/proxy/queries/useInfo', () => ({
  useSystemLimits: () => ({ maxCpu: 4, maxMemory: 8192 }),
}));

vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: (...args: unknown[]) => mockNotifySuccess(...args),
  notifyError: vi.fn(),
}));

vi.mock('@/react/docker/containers/queries/useContainer', () => ({
  invalidateContainer: (...args: unknown[]) => mockInvalidate(...args),
}));

vi.mock('./ResourcesFieldset', () => ({
  ResourceFieldset: ({
    values,
    onChange,
  }: {
    values: { cpu: number; reservation: number; limit: number };
    onChange: (values: {
      cpu: number;
      reservation: number;
      limit: number;
    }) => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => onChange({ ...values, limit: 256 })}
      >
        bump-limit
      </button>
      <button
        type="button"
        onClick={() => onChange({ cpu: 0, reservation: 0, limit: 0 })}
      >
        unlimited
      </button>
    </div>
  ),
  resourcesValidation: () =>
    object({
      reservation: number().min(0),
      limit: number().min(0),
      cpu: number().min(0),
    }),
}));

describe('REQ-CTR-03 EditResourcesForm for duplicate create limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redeploy.mockResolvedValue(true);
    server.use(
      http.post(
        '/api/endpoints/:endpointId/docker/containers/:id/update',
        () => HttpResponse.json({ Warnings: [] })
      )
    );
  });

  it('updates limits without redeploying when values stay limited', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const Wrapped = withTestQueryProvider(
      withTestRouter(
        withUserProvider(
          () => (
            <EditResourcesForm
              initialValues={{ cpu: 1, reservation: 64, limit: 128 }}
              onChange={onChange}
              redeploy={redeploy}
              isImageInvalid={false}
            />
          ),
          createMockUser()
        )
      )
    );
    render(<Wrapped />);

    await user.click(await screen.findByRole('button', { name: 'bump-limit' }));
    expect(onChange).toHaveBeenCalledWith({
      cpu: 1,
      reservation: 64,
      limit: 256,
    });

    await user.click(screen.getByRole('button', { name: 'Update Limits' }));
    await waitFor(() =>
      expect(mockNotifySuccess).toHaveBeenCalledWith('Success', 'Limits updated')
    );
    expect(redeploy).not.toHaveBeenCalled();
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it('redeploys when a limit is cleared to unlimited', async () => {
    const user = userEvent.setup();

    const Wrapped = withTestQueryProvider(
      withTestRouter(
        withUserProvider(
          () => (
            <EditResourcesForm
              initialValues={{ cpu: 1, reservation: 64, limit: 128 }}
              onChange={vi.fn()}
              redeploy={redeploy}
              isImageInvalid={false}
            />
          ),
          createMockUser()
        )
      )
    );
    render(<Wrapped />);

    await user.click(await screen.findByRole('button', { name: 'unlimited' }));
    expect(screen.getByText(/redeploy this container/i)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Update Limits' }));
    await waitFor(() => expect(redeploy).toHaveBeenCalled());
    expect(mockNotifySuccess).not.toHaveBeenCalled();
  });
});
