import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { useAuthorizations } from '@/react/hooks/useUser';
import { notifySuccess } from '@/portainer/services/notifications';

import { usePullImageMutation } from '../queries/usePullImageMutation';

import { PullImageFormWidget } from './PullImageFormWidget';

vi.mock('@/react/hooks/useUser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/react/hooks/useUser')>();
  return { ...actual, useAuthorizations: vi.fn() };
});
vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 7,
}));
vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: vi.fn(),
}));
vi.mock('../queries/usePullImageMutation');
vi.mock('@@/ImageConfigFieldset/getImageConfig', () => ({
  getDefaultImageConfig: () => ({
    image: 'nginx:latest',
  }),
}));
vi.mock('./PullImageFormWidget.Form', () => ({
  PullImageForm: () => (
    <div>
      <button type="submit" form="pull-form">
        submit-via-formik
      </button>
    </div>
  ),
}));
vi.mock('formik', async (importOriginal) => {
  const actual = await importOriginal<typeof import('formik')>();
  return {
    ...actual,
    Formik: ({
      children,
      onSubmit,
      initialValues,
    }: {
      children: React.ReactNode;
      onSubmit: (v: unknown) => void;
      initialValues: unknown;
    }) => (
      <form
        id="pull-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(initialValues);
        }}
      >
        {children}
      </form>
    ),
  };
});

describe('PullImageFormWidget submit', () => {
  it('REQ-TAI-005 pulls the image by name only and notifies on success', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts?: { onSuccess?: () => void }) => {
      opts?.onSuccess?.();
    });
    vi.mocked(useAuthorizations).mockReturnValue({
      authorized: true,
      isLoading: false,
    } as ReturnType<typeof useAuthorizations>);
    vi.mocked(usePullImageMutation).mockReturnValue({
      mutate,
      isLoading: false,
    } as ReturnType<typeof usePullImageMutation>);

    const Wrapped = withTestQueryProvider(withTestRouter(PullImageFormWidget));
    render(<Wrapped />);

    await user.click(screen.getByText('submit-via-formik'));

    expect(mutate).toHaveBeenCalledWith(
      {
        environmentId: 7,
        image: 'nginx:latest',
        ignoreErrors: false,
      },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    expect(notifySuccess).toHaveBeenCalledWith(
      'Image successfully pulled',
      'nginx:latest'
    );
  });
});
