import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Formik, Form } from 'formik';

import { LogoFieldset } from './LogoFieldset';

describe('REQ-SET-01 LogoFieldset', () => {
  it('toggles the custom logo URL field', async () => {
    const user = userEvent.setup();
    render(
      <Formik
        initialValues={{ logo: '', logoEnabled: false }}
        onSubmit={() => {}}
      >
        <Form>
          <LogoFieldset />
        </Form>
      </Formik>
    );
    expect(screen.queryByLabelText('URL')).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox'));
    expect(await screen.findByPlaceholderText(/logo.png/)).toBeVisible();
  });
});
