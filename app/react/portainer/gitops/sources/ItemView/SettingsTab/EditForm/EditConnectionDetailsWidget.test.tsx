import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Formik } from 'formik';

import { EditConnectionDetailsWidget } from './EditConnectionDetailsWidget';
import { SettingsFormValues } from './types';

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

function renderWidget() {
  return render(
    <Formik initialValues={initialValues} onSubmit={() => {}}>
      <EditConnectionDetailsWidget />
    </Formik>
  );
}

describe('REQ-GIT-01 EditConnectionDetailsWidget', () => {
  it('TestREQ_GIT_01_edits_name_url_and_tls_skip', async () => {
    const user = userEvent.setup();
    renderWidget();

    expect(screen.getByText('Connection Details')).toBeVisible();

    await user.clear(screen.getByTestId('source-name-input'));
    await user.type(screen.getByTestId('source-name-input'), 'new-name');
    expect(screen.getByTestId('source-name-input')).toHaveValue('new-name');

    await user.clear(screen.getByTestId('source-url-input'));
    await user.type(
      screen.getByTestId('source-url-input'),
      'https://example.com/r.git'
    );
    expect(screen.getByTestId('source-url-input')).toHaveValue(
      'https://example.com/r.git'
    );

    const tlsSwitch = screen.getByTestId('source-tls-skip-verify');
    expect(tlsSwitch).toHaveAttribute('aria-checked', 'false');
    await user.click(tlsSwitch);
    expect(screen.getByTestId('source-tls-skip-verify')).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });
});
