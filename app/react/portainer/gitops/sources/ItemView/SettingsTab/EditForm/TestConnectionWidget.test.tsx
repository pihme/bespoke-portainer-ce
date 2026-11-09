import { render, screen } from '@testing-library/react';
import { Formik } from 'formik';

import { TestConnectionWidget } from './TestConnectionWidget';
import { SettingsFormValues } from './types';

vi.mock('../../TestConnectionButton', () => ({
  TestConnectionButton: ({
    sourceId,
    payload,
    'data-cy': dataCy,
    showError,
  }: {
    sourceId: number;
    payload: unknown;
    'data-cy': string;
    showError?: boolean;
  }) => (
    <div data-cy={dataCy}>
      test-{sourceId}-{showError ? 'err' : 'tip'}-
      {JSON.stringify(payload)}
    </div>
  ),
}));

vi.mock('./payload', () => ({
  buildUpdatePayload: () => ({ name: 'changed-name', url: undefined }),
}));

const initialValues: SettingsFormValues = {
  name: 'src',
  url: 'https://github.com/org/repo.git',
  tlsSkipVerify: false,
  authEnabled: false,
  username: '',
  password: '',
  pollingEnabled: false,
  interval: '',
};

describe('REQ-GIT-01 TestConnectionWidget', () => {
  it('TestREQ_GIT_01_renders_test_card_and_forwards_payload', () => {
    render(
      <Formik initialValues={initialValues} onSubmit={() => {}}>
        <TestConnectionWidget sourceId={4} />
      </Formik>
    );

    expect(screen.getByText('Test Connection')).toBeVisible();
    expect(
      screen.getByText(/verify your settings are correct before saving/i)
    ).toBeVisible();
    expect(
      screen.getByTestId('source-test-connection-settings-btn')
    ).toHaveTextContent('test-4-err-{"name":"changed-name"}');
  });
});
