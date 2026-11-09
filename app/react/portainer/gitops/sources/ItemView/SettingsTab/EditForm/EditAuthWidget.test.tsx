import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Formik } from 'formik';

import { EditAuthWidget } from './EditAuthWidget';
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

function renderWidget(values: SettingsFormValues = initialValues) {
  return render(
    <Formik initialValues={values} onSubmit={() => {}}>
      <EditAuthWidget />
    </Formik>
  );
}

describe('REQ-GIT-01 EditAuthWidget', () => {
  it('TestREQ_GIT_01_enables_authentication_fields', async () => {
    const user = userEvent.setup();
    renderWidget();

    expect(screen.getByTestId('source-auth-enabled')).toBeInTheDocument();
    await user.click(screen.getByTestId('source-auth-enabled'));

    expect(screen.getByLabelText(/Username/i)).toBeVisible();
  });
});
