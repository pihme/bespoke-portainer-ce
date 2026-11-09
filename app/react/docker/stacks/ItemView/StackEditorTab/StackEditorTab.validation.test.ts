import { describe, expect, it } from 'vitest';

import { getValidationSchema } from './StackEditorTab.validation';

describe('getValidationSchema', () => {
  it('defers empty stack file content to required validation', async () => {
    const schema = getValidationSchema();
    await expect(
      schema.validate(
        {
          stackFileContent: '',
          environmentVariables: [],
          prune: false,
          registries: [],
          enabledWebhook: false,
        },
        { abortEarly: false }
      )
    ).rejects.toBeTruthy();

    // Exercise the field schema directly so the yaml test early-return runs
    await expect(
      (schema.fields as { stackFileContent: { validate: (v: unknown) => Promise<unknown> } }).stackFileContent.validate(
        ''
      )
    ).rejects.toBeTruthy();
  });
});
