import { describe, expect, it } from 'vitest';

import { getDefaultValues } from './getDefaultValues';
import { validation } from './validation';

describe('CustomTemplatesVariablesField helpers', () => {
  it('getDefaultValues maps definitions to key/value pairs', () => {
    expect(getDefaultValues()).toEqual([]);
    expect(
      getDefaultValues([
        { name: 'a', label: 'A', defaultValue: '1', description: '' },
      ])
    ).toEqual([{ key: 'a', value: '1' }]);
  });

  it('validation requires values when definition has no default', async () => {
    const schema = validation([
      { name: 'a', label: 'A', defaultValue: '', description: '' },
      { name: 'b', label: 'B', defaultValue: 'x', description: '' },
    ]);
    await expect(schema.validate([{ key: 'a', value: '' }])).rejects.toBeTruthy();
    await expect(
      schema.validate([
        { key: 'a', value: 'set' },
        { key: 'b', value: '' },
      ])
    ).resolves.toBeTruthy();
    await expect(
      schema.validate([{ key: 'unknown', value: '' }])
    ).resolves.toBeTruthy();
  });
});
