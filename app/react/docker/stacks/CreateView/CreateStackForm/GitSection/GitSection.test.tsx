import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Formik } from 'formik';
import { describe, expect, it, vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestRouter } from '@/react/test-utils/withRouter';

import { mockFormValues } from '../test-utils';

import { GitSection } from './GitSection';
import { GitFormValues } from './types';

vi.mock('@/react/portainer/gitops/GitForm', () => ({
  GitForm: (props: {
    onChange: (v: object) => void;
    isDockerStandalone?: boolean;
    value: { RepositoryURL?: string };
  }) => (
    <div>
      <span>Git repository</span>
      <span>Source</span>
      <span data-cy="git-url">{props.value?.RepositoryURL || ''}</span>
      <button
        type="button"
        data-cy="git-form-change"
        onClick={() =>
          props.onChange({ RepositoryURL: 'https://example.com/repo.git' })
        }
      >
        change
      </button>
      {props.isDockerStandalone ? <span>standalone</span> : null}
    </div>
  ),
}));

vi.mock('@/react/portainer/feature-flags/feature-flags.service', () => ({
  isBE: false,
}));

vi.mock('@/portainer/helpers/webhookHelper', () => ({
  baseStackWebhookUrl: () => 'https://example.com/webhooks',
}));

describe('GitSection', () => {
  it('should render the git repository section', () => {
    renderComponent();
    expect(screen.getByText('Git repository')).toBeInTheDocument();
  });

  it('should render the source selector', () => {
    renderComponent();
    expect(screen.getByText('Source')).toBeInTheDocument();
  });

  it('should render with auto update enabled', () => {
    renderComponent({
      webhookId: 'webhookId',
      initialValues: {
        AutoUpdate: {
          RepositoryAutomaticUpdates: true,
          ForcePullImage: false,
          RepositoryAutomaticUpdatesForce: false,
        },
      },
    });
    expect(screen.getByText('Git repository')).toBeInTheDocument();
  });

  it('should render with docker standalone flag', () => {
    renderComponent({ isDockerStandalone: true });
    expect(screen.getByText('standalone')).toBeInTheDocument();
  });

  it('merges git form changes into Formik values', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByTestId('git-form-change'));
    expect(screen.getByTestId('git-url')).toHaveTextContent(
      'https://example.com/repo.git'
    );
  });
});

function renderComponent({
  webhookId = 'webhook',
  initialValues,
  isDockerStandalone,
}: {
  webhookId?: string;
  isDockerStandalone?: boolean;
  initialValues?: Partial<GitFormValues>;
} = {}) {
  const values = mockFormValues({
    method: 'repository',
    git: {
      SourceId: 0,
      RepositoryReferenceName: 'refs/heads/main',
      ComposeFilePathInRepository: 'docker-compose.yml',
      AdditionalFiles: [],
      AutoUpdate: undefined,
      SupportRelativePath: false,
      FilesystemPath: '',
      ...initialValues,
    },
  });

  const Wrapped = withTestRouter(
    withUserProvider(
      withTestQueryProvider(() => (
        <Formik initialValues={values} onSubmit={() => {}} validateOnMount>
          <GitSection
            webhookId={webhookId}
            isDockerStandalone={isDockerStandalone}
          />
        </Formik>
      ))
    )
  );

  return render(<Wrapped />);
}
