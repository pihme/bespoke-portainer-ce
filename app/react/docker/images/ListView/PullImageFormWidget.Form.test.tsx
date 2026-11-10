import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Formik } from 'formik';
import { vi } from 'vitest';

import { PullImageForm } from './PullImageFormWidget.Form';
import { FormValues } from './PullImageFormWidget.types';

vi.mock('@@/ImageConfigFieldset', () => ({
  ImageConfigFieldset: ({
    children,
    setFieldValue,
    ...rest
  }: {
    children: React.ReactNode;
    setFieldValue: (field: string, value: unknown) => void;
  }) => (
    <div data-cy="image-config" data-props={Object.keys(rest).join(',')}>
      <button type="button" onClick={() => setFieldValue('image', 'nginx')}>
        set-image
      </button>
      {children}
    </div>
  ),
}));

vi.mock('@@/form-components/FormSection', () => ({
  FormSection: ({ children }: { children: React.ReactNode }) => (
    <div data-cy="deployment">{children}</div>
  ),
}));

vi.mock('@@/form-components/FormActions', () => ({
  FormActions: ({
    isLoading,
    submitLabel,
  }: {
    isLoading: boolean;
    submitLabel: string;
  }) => (
    <button type="submit" disabled={isLoading}>
      {submitLabel}
    </button>
  ),
}));

const initial: FormValues = {
  config: { image: '' },
};

function renderForm(props: { isLoading?: boolean }) {
  return render(
    <Formik initialValues={initial} onSubmit={vi.fn()}>
      <PullImageForm isLoading={props.isLoading ?? false} />
    </Formik>
  );
}

describe('PullImageForm', () => {
  it('REQ-TAI-007 shows no node selector', async () => {
    const user = userEvent.setup();
    renderForm({});
    expect(screen.queryByTestId('deployment')).not.toBeInTheDocument();
    await user.click(screen.getByText('set-image'));
  });

  it('REQ-TAI-005 passes no rate limit or autocomplete props to the image field', () => {
    renderForm({});
    expect(screen.getByTestId('image-config')).toHaveAttribute(
      'data-props',
      'values,errors'
    );
  });

});
