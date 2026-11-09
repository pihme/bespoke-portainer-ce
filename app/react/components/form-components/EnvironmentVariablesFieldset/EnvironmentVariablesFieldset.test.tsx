import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  EnvironmentVariablesFieldset,
  envVarValidation,
} from './EnvironmentVariablesFieldset';
import { EnvironmentVariablesPanel } from './EnvironmentVariablesPanel';
import { StackEnvironmentVariablesPanel } from './StackEnvironmentVariablesPanel';
import { EnvironmentVariableItem } from './EnvironmentVariableItem';

vi.mock('@@/PageHeader/ContextHelp', () => ({
  useDocsUrl: (path: string) => `https://docs.example${path}`,
}));

vi.mock('@/portainer/services/fileUploadReact', () => ({
  readFileAsText: vi.fn(async () => 'FROM_FILE=1\n'),
}));

describe('EnvironmentVariablesFieldset', () => {
  it('renders simple mode, adds a variable, and switches to advanced', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <EnvironmentVariablesFieldset
        values={[{ name: 'FOO', value: 'bar' }]}
        onChange={onChange}
      />
    );

    expect(screen.getByDisplayValue('FOO')).toBeVisible();
    await user.click(
      screen.getByTestId('add-environment-variable-button')
    );
    expect(onChange).toHaveBeenCalledWith([
      { name: 'FOO', value: 'bar' },
      { name: '', value: '', needsDeletion: false },
    ]);

    await user.click(
      screen.getByTestId('environment-variables-advanced-mode-button')
    );
    expect(screen.getByTestId('env-simple-mode-button')).toBeVisible();
    expect(screen.getByTestId('env-var-advanced-mode')).toBeVisible();
  });


  it('switches back to simple and applies advanced editor changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <EnvironmentVariablesFieldset
        values={[{ name: 'FOO', value: 'bar' }]}
        onChange={onChange}
      />
    );
    await user.click(
      screen.getByTestId('environment-variables-advanced-mode-button')
    );
    const editor = screen.getByTestId('env-var-advanced-mode');
    fireEvent.change(editor, { target: { value: 'NEW=1' } });
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        { name: 'NEW', value: '1', needsDeletion: false },
      ])
    );
    await user.click(screen.getByTestId('env-simple-mode-button'));
    expect(
      screen.getByTestId('environment-variables-advanced-mode-button')
    ).toBeVisible();
  });

  it('loads variables from a .env file in simple mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <EnvironmentVariablesFieldset values={[]} onChange={onChange} />
    );
    const fileInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(['FROM_FILE=1\n'], 'vars.env', {
      type: 'text/plain',
    });
    await user.upload(fileInput, file);
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        { name: 'FROM_FILE', value: '1', needsDeletion: false },
      ])
    );
  });
});

describe('envVarValidation', () => {
  it('requires names and rejects duplicates', async () => {
    const schema = envVarValidation();
    await expect(
      schema.validate([{ name: 'A', value: '1' }])
    ).resolves.toBeTruthy();
    await expect(schema.validate([{ name: '', value: '' }])).rejects.toThrow(
      /required/i
    );
    await expect(
      schema.validate(
        [
          { name: 'A', value: '1' },
          { name: 'A', value: '2' },
        ],
        { abortEarly: false }
      )
    ).rejects.toThrow(/already defined/i);
  });
});

describe('EnvironmentVariableItem', () => {
  it('updates name and value and shows errors', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <EnvironmentVariableItem
        item={{ name: 'A', value: '1' }}
        onChange={onChange}
        index={0}
        error={{ name: 'bad name' }}
      />
    );
    expect(screen.getByText('bad name')).toBeVisible();
    await user.type(screen.getByDisplayValue('A'), 'B');
    expect(onChange).toHaveBeenCalled();
    await user.type(screen.getByDisplayValue('1'), '2');
    expect(onChange).toHaveBeenCalled();
  });
});

describe('EnvironmentVariablesPanel', () => {
  it('renders explanation, help message and fieldset', () => {
    render(
      <EnvironmentVariablesPanel
        values={[]}
        onChange={() => {}}
        explanation={<span>Explain</span>}
        showHelpMessage
        alertMessage={<span>Alert</span>}
      />
    );
    expect(screen.getByText('Environment variables')).toBeVisible();
    expect(screen.getByText('Explain')).toBeVisible();
    expect(screen.getByText('Alert')).toBeVisible();
    expect(
      screen.getByText(/Environment changes will not take effect/i)
    ).toBeVisible();
  });
});

describe('StackEnvironmentVariablesPanel', () => {
  it('renders stack-specific help and alert', () => {
    render(
      <StackEnvironmentVariablesPanel
        values={[]}
        onChange={() => {}}
        showHelpMessage
      />
    );
    expect(
      screen.getByTestId('stack-env-vars-help-link')
    ).toHaveAttribute(
      'href',
      'https://docs.example/user/docker/stacks/add#environment-variables'
    );
    expect(screen.getByText(/stack.env file operation/i)).toBeVisible();
  });
});
