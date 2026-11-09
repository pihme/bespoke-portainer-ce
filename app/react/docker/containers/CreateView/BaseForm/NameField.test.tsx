import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { NameField, nameValidation } from './NameField';

describe('REQ-CTR-03 NameField', () => {
  it('renders and forwards name changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NameField value="" onChange={onChange} error="required" />);

    expect(screen.getByText('required')).toBeVisible();
    await user.type(screen.getByTestId('container-name-input'), 'web');
    expect(onChange).toHaveBeenCalled();
  });

  it('provides a default name schema', async () => {
    await expect(nameValidation().validate(undefined)).resolves.toBe('');
  });
});
