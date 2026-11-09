import { render, screen } from '@testing-library/react';
import { Formik, Form } from 'formik';
import { vi } from 'vitest';

import { TemplatesUrlSection } from './TemplatesUrlSection';

vi.mock('@@/PageHeader/ContextHelp', () => ({
  useDocsUrl: () => 'https://docs.example/templates',
}));

describe('REQ-SET-01 TemplatesUrlSection', () => {
  it('renders the templates URL field', () => {
    render(
      <Formik initialValues={{ templatesUrl: '' }} onSubmit={() => {}}>
        <Form>
          <TemplatesUrlSection />
        </Form>
      </Formik>
    );
    expect(screen.getByText('App Templates')).toBeVisible();
    expect(screen.getByTestId('settings-templateUrl')).toBeVisible();
  });
});
