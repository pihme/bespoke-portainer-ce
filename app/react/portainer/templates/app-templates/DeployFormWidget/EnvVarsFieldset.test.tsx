import { ReactNode } from 'react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';

import {
  EnvVarsFieldset,
  getDefaultValues,
  envVarsFieldsetValidation,
} from './EnvVarsFieldset';

// Tippy renders tooltip content in a portal which is not accessible without
// user interaction in jsdom. Mock Tooltip to render its message inline so
// tests can assert on the message text.
vi.mock('@@/Tip/Tooltip/Tooltip', () => ({
  Tooltip: ({ message }: { message: ReactNode }) => (
    <span data-cy="tooltip">{message}</span>
  ),
}));

test('renders EnvVarsFieldset component', () => {
  const onChange = vi.fn();
  const options = [
    { name: 'VAR1', label: 'Variable 1', preset: false },
    { name: 'VAR2', label: 'Variable 2', preset: false },
  ] as const;
  const value = { VAR1: 'Value 1', VAR2: 'Value 2' };

  render(
    <EnvVarsFieldset
      onChange={onChange}
      options={[...options]}
      values={value}
      errors={{}}
    />
  );

  options.forEach((option) => {
    const labelElement = screen.getByLabelText(option.label, { exact: false });
    expect(labelElement).toBeInTheDocument();

    const inputElement = screen.getByDisplayValue(value[option.name]);
    expect(inputElement).toBeInTheDocument();
  });
});

test('renders the env var description as a tooltip', () => {
  const onChange = vi.fn();
  const options = [
    {
      name: 'VAR1',
      label: 'Variable 1',
      description: 'Helpful description for variable 1',
      preset: false,
    },
  ];
  const value = { VAR1: 'Value 1' };

  render(
    <EnvVarsFieldset
      onChange={onChange}
      options={options}
      values={value}
      errors={{}}
    />
  );

  expect(
    screen.getByText('Helpful description for variable 1')
  ).toBeInTheDocument();
});

test('does not render a tooltip when the env var has no description', () => {
  const onChange = vi.fn();
  const options = [{ name: 'VAR1', label: 'Variable 1', preset: false }];
  const value = { VAR1: 'Value 1' };

  render(
    <EnvVarsFieldset
      onChange={onChange}
      options={options}
      values={value}
      errors={{}}
    />
  );

  expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
});

test('calls onChange when input value changes', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const options = [{ name: 'VAR1', label: 'Variable 1', preset: false }];
  const value = { VAR1: 'Value 1' };

  render(
    <EnvVarsFieldset
      onChange={onChange}
      options={options}
      values={value}
      errors={{}}
    />
  );

  const inputElement = screen.getByDisplayValue(value.VAR1);
  await user.clear(inputElement);
  expect(onChange).toHaveBeenCalledWith({ VAR1: undefined });

  const newValue = 'New Value';
  await user.type(inputElement, newValue);
  expect(onChange).toHaveBeenCalled();
});

test('renders error message when there are errors', () => {
  const onChange = vi.fn();
  const options = [{ name: 'VAR1', label: 'Variable 1', preset: false }];
  const value = { VAR1: '' };

  render(
    <EnvVarsFieldset
      onChange={onChange}
      options={options}
      values={value}
      errors={{ VAR1: 'Required' }}
    />
  );

  const errorElement = screen.getByText('Required');
  expect(errorElement).toBeInTheDocument();
});

test('returns default values', () => {
  const definitions = [
    {
      name: 'VAR1',
      label: 'Variable 1',
      preset: false,
      default: 'Default Value 1',
    },
    {
      name: 'VAR2',
      label: 'Variable 2',
      preset: false,
      default: 'Default Value 2',
    },
  ];

  const defaultValues = getDefaultValues(definitions);

  expect(defaultValues).toEqual({
    VAR1: 'Default Value 1',
    VAR2: 'Default Value 2',
  });
});

test('validates env vars fieldset', () => {
  const schema = envVarsFieldsetValidation([
    { name: 'VAR1' },
    { name: 'VAR2' },
  ]);

  const validData = { VAR1: 'Value 1', VAR2: 'Value 2' };
  const emptyData = { VAR1: '', VAR2: 'Value 2' };
  const undefinedData = { VAR1: undefined, VAR2: 'Value 2' };

  const validResult = schema.isValidSync(validData);
  const emptyResult = schema.isValidSync(emptyData);
  const undefinedResult = schema.isValidSync(undefinedData);

  expect(validResult).toBe(true);
  expect(emptyResult).toBe(true);
  expect(undefinedResult).toBe(true);
});

test('renders a select env var and notifies on change', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const options = [
    {
      name: 'CHOICE',
      label: 'Choice',
      select: [
        { text: 'One', value: '1', default: true },
        { text: 'Two', value: '2', default: false },
      ],
    },
  ];

  render(
    <EnvVarsFieldset
      onChange={onChange}
      options={options}
      values={{ CHOICE: '1' }}
      errors={{}}
    />
  );

  const select = screen.getByLabelText('Choice', { exact: false });
  await user.selectOptions(select, '2');
  expect(onChange).toHaveBeenCalledWith({ CHOICE: '2' });
});

test('disables preset env vars and falls back to the name as label', () => {
  render(
    <EnvVarsFieldset
      onChange={vi.fn()}
      options={[{ name: 'SECRET', preset: true, default: 'x' }]}
      values={{ SECRET: 'x' }}
      errors={{}}
    />
  );

  const input = screen.getByLabelText('SECRET', { exact: false });
  expect(input).toBeDisabled();
});

test('getDefaultValues prefers the default select option', () => {
  expect(
    getDefaultValues([
      {
        name: 'CHOICE',
        select: [
          { text: 'One', value: '1', default: false },
          { text: 'Two', value: '2', default: true },
        ],
      },
      { name: 'TEXT', default: 'hi' },
      {
        name: 'EMPTY',
        select: [{ text: 'None', value: 'n', default: false }],
      },
    ])
  ).toEqual({ CHOICE: '2', TEXT: 'hi', EMPTY: '' });
});

test('envVarsFieldsetValidation ignores preset definitions', () => {
  const schema = envVarsFieldsetValidation([
    { name: 'VISIBLE' },
    { name: 'HIDDEN', preset: true },
  ]);

  expect(schema.isValidSync({ VISIBLE: 'ok' })).toBe(true);
  expect(schema.describe().fields).toHaveProperty('VISIBLE');
  expect(schema.describe().fields).not.toHaveProperty('HIDDEN');
});
