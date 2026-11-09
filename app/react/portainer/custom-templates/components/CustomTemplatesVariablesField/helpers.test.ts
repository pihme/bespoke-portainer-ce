import { describe, expect, it } from 'vitest';

import { getDefaultValues } from './getDefaultValues';
import { validation } from './validation';

describe('CustomTemplatesVariablesField helpers', () => {
  it('maps definitions to default values', () => {
    expect(getDefaultValues()).toEqual([]);
    expect(
      getDefaultValues([
        {
          name: 'A',
          label: 'A',
          description: '',
          defaultValue: '1',
        },
        {
          name: 'B',
          label: 'B',
          description: '',
          defaultValue: '',
        },
      ])
    ).toEqual([
      { key: 'A', value: '1' },
      { key: 'B', value: '' },
    ]);
  });

  it('requires values when definitions have no default', async () => {
    const schema = validation([
      {
        name: 'required',
        label: 'R',
        description: '',
        defaultValue: '',
      },
      {
        name: 'optional',
        label: 'O',
        description: '',
        defaultValue: 'x',
      },
    ]);

    await expect(
      schema.validate([{ key: 'required', value: '' }])
    ).rejects.toThrow(/required/i);
    await expect(
      schema.validate([{ key: 'required', value: 'ok' }])
    ).resolves.toEqual([{ key: 'required', value: 'ok' }]);
    await expect(
      schema.validate([{ key: 'optional', value: '' }])
    ).resolves.toEqual([{ key: 'optional', value: '' }]);
    await expect(
      schema.validate([{ key: 'unknown', value: '' }])
    ).resolves.toEqual([{ key: 'unknown', value: '' }]);
  });
});
