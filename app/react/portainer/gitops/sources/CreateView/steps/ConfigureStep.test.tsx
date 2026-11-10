import { render, screen } from '@testing-library/react';
import { Formik } from 'formik';
import { vi } from 'vitest';

import { FormValueTypes } from '../type';

import { ConfigureStep, validateConfigureStep } from './ConfigureStep';

vi.mock('./ConfigureGit', () => ({
  ConfigureGit: () => <div data-cy="git-panel">git</div>,
}));
vi.mock('@@/Widget', () => ({
  Widget: {
    Title: ({ title }: { title: string }) => <h3>{title}</h3>,
    Body: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
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

  it('REQ-TAI-018 offers only the Git panel', () => {
    expect(FormValueTypes).toEqual(['git']);
  });

  it('exports a validation schema for name and git', () => {
    expect(validateConfigureStep()).toBeTruthy();
  });
});
