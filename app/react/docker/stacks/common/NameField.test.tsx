import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react-hooks';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { Stack, StackStatus, StackType } from '@/react/common/stacks/types';

import { NameField, nameValidation, useNameValidation } from './NameField';

function stack(partial: Partial<Stack> & Pick<Stack, 'Name' | 'EndpointId'>): Stack {
  return {
    Id: 1,
    Type: StackType.DockerCompose,
    Status: StackStatus.Active,
    CreationDate: 0,
    CreatedBy: '',
    UpdateDate: 0,
    UpdatedBy: '',
    IsComposeFormat: true,
    GitConfig: null,
    FromAppTemplate: false,
    Namespace: '',
    AdditionalFiles: null,
    AutoUpdate: null,
    Option: null,
    ...partial,
  } as Stack;
}

describe('NameField', () => {
  it('renders and forwards name changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <NameField value="" onChange={onChange} errors="required" placeholder="my-stack" />
    );

    expect(screen.getByText('required')).toBeVisible();
    await user.type(screen.getByTestId('stack-name-input'), 'web');
    expect(onChange).toHaveBeenCalled();
  });
});

describe('nameValidation', () => {
  it('accepts unique valid names and rejects duplicates and invalid chars', async () => {
    const schema = nameValidation({
      environmentId: 1,
      stacks: [
        stack({ Name: 'existing', EndpointId: 1 }),
        stack({ Name: 'other-env', EndpointId: 2 }),
      ],
    });

    await expect(schema.validate('fresh-name')).resolves.toBe('fresh-name');
    await expect(schema.validate('other-env')).resolves.toBe('other-env');
    await expect(schema.validate('existing')).rejects.toThrow(/unique/);
    await expect(schema.validate('Bad_Name')).rejects.toThrow(/lower case/);
    await expect(schema.validate('')).resolves.toBe('');
  });

  it('allows the excluded stack name when editing', async () => {
    const schema = nameValidation({
      environmentId: 1,
      stacks: [stack({ Name: 'keep-me', EndpointId: 1 })],
      excludeStackName: 'keep-me',
    });
    await expect(schema.validate('keep-me')).resolves.toBe('keep-me');
  });
});

describe('useNameValidation', () => {
  it('builds a required schema for the environment', async () => {
    const wrapper = withTestQueryProvider(({ children }) => <>{children}</>);
    const { result, waitForNextUpdate } = renderHook(
      () => useNameValidation(1),
      { wrapper }
    );

    // schema is available immediately (stacks query may be loading → empty list)
    await expect(result.current.validate('ok-name')).resolves.toBe('ok-name');
    await expect(result.current.validate('')).rejects.toThrow(/required/);
    // drain any pending query update to avoid act warnings
    try {
      await waitForNextUpdate({ timeout: 50 });
    } catch {
      // no update is fine
    }
  });
});
