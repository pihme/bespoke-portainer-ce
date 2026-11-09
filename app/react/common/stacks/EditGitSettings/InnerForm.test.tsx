import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Formik } from 'formik';
import { describe, expect, it, vi } from 'vitest';

import { StackType } from '@/react/common/stacks/types';
import { Environment } from '@/react/portainer/environments/types';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

import { InnerForm } from './InnerForm';
import { FormValues } from './types';

const environmentState = vi.hoisted(() => ({
  data: { Id: 1, Type: 1 } as Environment,
}));

vi.mock('@/react/hooks/useCurrentEnvironment', () => ({
  useCurrentEnvironment: () => ({ data: environmentState.data }),
}));

vi.mock('@/react/docker/proxy/queries/useInfo', () => ({
  useIsStandalone: () => true,
}));

vi.mock('@/react/portainer/gitops/GitForm', () => ({
  GitForm: ({
    onChange,
  }: {
    onChange: (partial: Record<string, unknown>) => void;
  }) => (
    <button
      type="button"
      data-cy="mock-git-change"
      onClick={() => onChange({ RepositoryReferenceName: 'develop' })}
    >
      change-git
    </button>
  ),
}));

vi.mock('@@/form-components/EnvironmentVariablesFieldset', () => ({
  StackEnvironmentVariablesPanel: ({
    onChange,
  }: {
    onChange: (value: unknown[]) => void;
  }) => (
    <button
      type="button"
      data-cy="mock-env-change"
      onClick={() => onChange([{ name: 'A', value: '1' }])}
    >
      change-env
    </button>
  ),
}));

vi.mock('../PruneField', () => ({
  PruneField: ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: (value: boolean) => void;
  }) => (
    <button
      type="button"
      data-cy="mock-prune-change"
      onClick={() => onChange(!checked)}
    >
      prune-{String(checked)}
    </button>
  ),
}));

vi.mock('@@/modals/Modal', () => {
  function Modal({
    children,
  }: {
    children: React.ReactNode;
    onDismiss?: () => void;
  }) {
    return <div data-cy="modal">{children}</div>;
  }
  Modal.Header = ({ title }: { title: React.ReactNode }) => <div>{title}</div>;
  Modal.Body = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  Modal.Footer = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return { Modal };
});

const initialValues: FormValues = {
  kube: { name: 'stack' },
  git: {
    SourceId: 1,
    RepositoryReferenceName: 'main',
    ComposeFilePathInRepository: 'docker-compose.yml',
    AdditionalFiles: [],
    AutoUpdate: undefined,
  } as FormValues['git'],
  env: [],
  prune: false,
  redeployNow: false,
};

describe('EditGitSettings InnerForm', () => {
  it('applies git, env, and prune changes for local Docker stacks', async () => {
    const user = userEvent.setup();
    environmentState.data = { Id: 1, Type: 1 } as Environment; // Docker
    const onDismiss = vi.fn();
    const Wrapped = withTestQueryProvider(() => (
      <Formik initialValues={initialValues} onSubmit={vi.fn()}>
        <InnerForm
          stackName="stack"
          stackType={StackType.DockerCompose}
          onDismiss={onDismiss}
          isSubmitting={false}
          webhookId="wh-1"
        />
      </Formik>
    ));
    render(<Wrapped />);

    await user.click(screen.getByTestId('mock-git-change'));
    await user.click(screen.getByTestId('mock-env-change'));
    await user.click(screen.getByTestId('mock-prune-change'));
    expect(screen.getByTestId('mock-prune-change')).toHaveTextContent(
      'prune-true'
    );

    await user.click(screen.getByTestId('cancel-button'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
