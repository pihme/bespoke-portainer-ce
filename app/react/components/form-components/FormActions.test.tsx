import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FormActions } from './FormActions';

describe('FormActions', () => {
  it('renders submit button enabled when valid and shows children', () => {
    render(
      <FormActions
        submitLabel="Save stack"
        loadingText="Saving"
        isLoading={false}
        isValid
        data-cy="form-actions-submit"
      >
        <button type="button">Cancel</button>
      </FormActions>
    );

    expect(screen.getByRole('button', { name: /Save stack/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible();
    expect(screen.queryByTestId('errors')).not.toBeInTheDocument();
  });

  it('disables submit when invalid and exposes serialized errors', () => {
    render(
      <FormActions
        submitLabel="Save"
        loadingText="Saving"
        isLoading={false}
        isValid={false}
        errors={{ name: 'required' }}
        data-cy="form-actions-submit"
      />
    );

    expect(screen.getByRole('button', { name: /Save/i })).toBeDisabled();
    expect(screen.getByTestId('errors')).toHaveTextContent(
      JSON.stringify({ name: 'required' })
    );
  });
});
