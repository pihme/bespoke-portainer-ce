import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  CustomTemplatesVariablesDefinitionField,
  validation,
} from './CustomTemplatesVariablesDefinitionField';

describe('CustomTemplatesVariablesDefinitionField', () => {
  it('renders definition inputs and forwards edits', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CustomTemplatesVariablesDefinitionField
        value={[
          {
            name: 'image',
            label: 'Image',
            defaultValue: 'nginx',
            description: 'img',
          },
        ]}
        onChange={onChange}
      />
    );
    expect(screen.getByDisplayValue('image')).toBeInTheDocument();
    await user.clear(screen.getByDisplayValue('Image'));
    await user.type(screen.getByPlaceholderText('Label'), 'Image2');
    expect(onChange).toHaveBeenCalled();
  });

  it('hides add button when names come from parent', () => {
    render(
      <CustomTemplatesVariablesDefinitionField
        value={[]}
        onChange={() => {}}
        isVariablesNamesFromParent
      />
    );
    expect(
      screen.queryByRole('button', { name: /add/i })
    ).not.toBeInTheDocument();
  });

  it('validation requires name and label', async () => {
    await expect(
      validation().validate([
        { name: '', label: '', defaultValue: '', description: '' },
      ])
    ).rejects.toBeTruthy();
    await expect(
      validation().validate([
        { name: 'n', label: 'l', defaultValue: '', description: '' },
      ])
    ).resolves.toBeTruthy();
  });
});
