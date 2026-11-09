import { render, screen } from '@testing-library/react';
import { Formik } from 'formik';
import { vi } from 'vitest';

import { ResourceControlOwnership } from '@/react/portainer/access-control/types';

import {
  AccessControlStep,
  validateAccessControlStep,
} from './AccessControlStep';

vi.mock('@/react/portainer/access-control/EditDetails', () => ({
  EditDetails: () => <div data-cy="edit-details">access</div>,
}));
vi.mock('@@/Widget', () => ({
  Widget: {
    Title: ({ title }: { title: string }) => <h3>{title}</h3>,
    Body: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}));

const values = {
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

describe('REQ-GIT-02 AccessControlStep', () => {
  it('renders access control details', () => {
    render(
      <Formik initialValues={values} onSubmit={() => {}}>
        <AccessControlStep />
      </Formik>
    );
    expect(screen.getByText('Access control')).toBeVisible();
    expect(screen.getByTestId('edit-details')).toBeVisible();
  });

  it('exports access-control validation', () => {
    expect(validateAccessControlStep()).toBeTruthy();
  });
});
