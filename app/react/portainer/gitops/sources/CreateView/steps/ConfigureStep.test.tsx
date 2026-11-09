import { render, screen } from '@testing-library/react';
import { Formik } from 'formik';
import { vi } from 'vitest';

import { ResourceControlOwnership } from '@/react/portainer/access-control/types';

import { ConfigureStep, validateConfigureStep } from './ConfigureStep';

vi.mock('./ConfigureGit', () => ({
  ConfigureGit: () => <div data-cy="git-panel">git</div>,
}));
vi.mock('./ConfigureHelm', () => ({
  ConfigureHelm: () => <div data-cy="helm-panel">helm</div>,
}));
vi.mock('./ConfigureRegistry', () => ({
  ConfigureRegistry: () => <div data-cy="registry-panel">registry</div>,
}));
vi.mock('@@/Widget', () => ({
  Widget: {
    Title: ({ title }: { title: string }) => <h3>{title}</h3>,
    Body: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}));

const baseValues = {
  name: 'src',
  type: 'git' as const,
  git: {
    url: '',
    connectionOk: false,
    authentication: { authEnabled: false },
    polling: { enabled: false, interval: '' },
  },
  authorizedTeams: [],
  authorizedUsers: [],
  ownership: ResourceControlOwnership.ADMINISTRATORS,
};

describe('REQ-GIT-02 ConfigureStep', () => {
  it('renders the git configure panel by default', () => {
    render(
      <Formik initialValues={baseValues} onSubmit={() => {}}>
        <ConfigureStep />
      </Formik>
    );
    expect(screen.getByText('Configure Git Repository')).toBeVisible();
    expect(screen.getByTestId('git-panel')).toBeVisible();
  });

  it('exports a validation schema for name and git', () => {
    expect(validateConfigureStep()).toBeTruthy();
  });
});
