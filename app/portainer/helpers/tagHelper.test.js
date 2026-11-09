import { describe, it, expect } from 'vitest';

import { idsToTagNames } from './tagHelper.js';

describe('REQ-ENV-14 tagHelper idsToTagNames', () => {
  const tags = [
    { ID: 1, Name: 'prod' },
    { ID: 2, Name: 'eu' },
    { ID: 3, Name: 'docker' },
  ];

  it('returns the Names of tags whose IDs are listed', () => {
    expect(idsToTagNames(tags, [3, 1])).toEqual(['prod', 'docker']);
  });

  it('skips IDs that are not in the tag list', () => {
    expect(idsToTagNames(tags, [99, 2])).toEqual(['eu']);
  });

  it('returns an empty list for an empty id list', () => {
    expect(idsToTagNames(tags, [])).toEqual([]);
  });
});
