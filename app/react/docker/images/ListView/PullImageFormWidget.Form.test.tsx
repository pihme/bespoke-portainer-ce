import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Formik } from 'formik';
import { vi } from 'vitest';

import { PullImageForm } from './PullImageFormWidget.Form';
import { FormValues } from './PullImageFormWidget.types';

vi.mock('@@/ImageConfigFieldset', () => ({
  ImageConfigFieldset: ({
    children,
    onRateLimit,
    setFieldValue,
  }: {
    children: React.ReactNode;
    onRateLimit: (limited?: boolean) => void;
    setFieldValue: (field: string, value: unknown) => void;
  }) => (
    <div data-cy="image-config">
      <button type="button" onClick={() => onRateLimit(true)}>
        rate-limit
      </button>
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

vi.mock('../../agent/NodeSelector', () => ({
  NodeSelector: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <button type="button" data-cy="node" onClick={() => onChange('node-a')}>
      node:{value || 'none'}
    </button>
  ),
}));

const initial: FormValues = {
  node: '',
  config: { image: '', registryId: 0, useRegistry: false },
};

function renderForm(props: {
  isNodeVisible?: boolean;
  isLoading?: boolean;
  onRateLimit?: (limited?: boolean) => void;
}) {
  const onRateLimit = props.onRateLimit || vi.fn();
  return render(
    <Formik initialValues={initial} onSubmit={vi.fn()}>
      <PullImageForm
        onRateLimit={onRateLimit}
        isLoading={props.isLoading ?? false}
        isNodeVisible={props.isNodeVisible ?? false}
      />
    </Formik>
  );
}

describe('PullImageForm', () => {
  it('hides node selector when not visible and forwards rate limit', async () => {
    const user = userEvent.setup();
    const onRateLimit = vi.fn();
    renderForm({ onRateLimit });
    expect(screen.queryByTestId('deployment')).not.toBeInTheDocument();
    await user.click(screen.getByText('rate-limit'));
    expect(onRateLimit).toHaveBeenCalledWith(true);
    await user.click(screen.getByText('set-image'));
  });

  it('shows node selector and updates node when visible', async () => {
    const user = userEvent.setup();
    renderForm({ isNodeVisible: true });
    expect(screen.getByTestId('deployment')).toBeVisible();
    await user.click(screen.getByTestId('node'));
    expect(screen.getByTestId('node')).toHaveTextContent('node:node-a');
  });
});
