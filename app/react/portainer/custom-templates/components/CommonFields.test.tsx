import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CommonFields, validation } from './CommonFields';

describe('CommonFields for local custom templates', () => {
  it('edits title description note and logo', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CommonFields
        values={{ Title: '', Description: '', Note: '', Logo: '' }}
        onChange={onChange}
        errors={{ Title: 'required' }}
      />
    );
    expect(screen.getByText('required')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Title/i), 't');
    expect(onChange).toHaveBeenCalled();
    await user.type(screen.getByLabelText(/Description/i), 'd');
    await user.type(screen.getByLabelText(/Note/i), 'n');
    await user.type(screen.getByLabelText(/Logo/i), 'l');
  });

  it('validation enforces required unique titles', async () => {
    const schema = validation({
      templates: [{ Id: 1, Title: 'taken' } as never],
    });
    await expect(
      schema.validate({
        Title: 'taken',
        Description: 'd',
        Note: '',
        Logo: '',
      })
    ).rejects.toThrow(/unique/i);
    await expect(
      schema.validate({
        Title: 'ok',
        Description: 'd',
        Note: '',
        Logo: '',
      })
    ).resolves.toBeTruthy();
  });
});
