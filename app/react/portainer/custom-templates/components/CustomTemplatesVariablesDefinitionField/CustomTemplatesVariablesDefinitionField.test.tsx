import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  CustomTemplatesVariablesDefinitionField,
  validation,
  Values,
} from './CustomTemplatesVariablesDefinitionField';

const sample: Values = [
  {
    name: 'var_name',
    label: 'Var',
    description: 'A variable',
    defaultValue: 'default',
  },
];

describe('CustomTemplatesVariablesDefinitionField', () => {
  it('renders variable inputs and forwards edits', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CustomTemplatesVariablesDefinitionField
        value={sample}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Variables definition')).toBeVisible();
    const name = screen.getByTestId('custom-templates-item-name-field_0');
    await user.clear(name);
    await user.type(name, 'new_name');
    expect(onChange).toHaveBeenCalled();

    const label = screen.getByTestId('custom-templates-item-label-field_0');
    await user.type(label, 'L');
    expect(onChange).toHaveBeenCalled();
  });

  it('marks names read-only when names come from parent', () => {
    render(
      <CustomTemplatesVariablesDefinitionField
        value={sample}
        onChange={() => {}}
        isVariablesNamesFromParent
      />
    );

    const name = screen.getByTestId(
      'custom-templates-item-name-field_0'
    ) as HTMLInputElement;
    expect(name.readOnly).toBe(true);
  });


  it('adds a blank variable definition via the add button', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CustomTemplatesVariablesDefinitionField value={sample} onChange={onChange} />
    );
    await user.click(screen.getByRole('button', { name: /add/i }));
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls.at(-1)?.[0] as Values;
    expect(lastCall).toHaveLength(2);
    expect(lastCall[1]).toEqual({
      label: '',
      name: '',
      defaultValue: '',
      description: '',
    });
  });

  it('validates variable definitions', async () => {
    const schema = validation();
    await expect(schema.validate(sample)).resolves.toBeTruthy();
    await expect(schema.validate([{ ...sample[0], name: '' }])).rejects.toThrow(
      /Name is required/
    );
  });
});
