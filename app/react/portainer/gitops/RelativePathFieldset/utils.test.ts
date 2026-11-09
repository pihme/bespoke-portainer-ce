import { describe, expect, it } from 'vitest';

import * as utils from './utils';
import { dummyGitForm } from './utils';

describe('dummyGitForm', () => {
  it('exposes empty git form defaults for path selectors', () => {
    expect(dummyGitForm).toEqual({
      SourceId: 0,
      AdditionalFiles: [],
      RepositoryReferenceName: '',
      ComposeFilePathInRepository: '',
    });
  });

  it('REQ-TAI-004 has no Edge stack relative path parser', () => {
    expect('parseRelativePathResponse' in utils).toBe(false);
  });
});
