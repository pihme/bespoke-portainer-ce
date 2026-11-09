import { workflowQueryKeys } from './query-keys';

describe('REQ-GIT-01 workflow query keys', () => {
  it('builds all, list, summary and detail keys', () => {
    expect(workflowQueryKeys.all).toEqual(['gitops', 'workflows']);
    expect(workflowQueryKeys.list({ limit: 10 })).toEqual([
      'gitops',
      'workflows',
      'list',
      { limit: 10 },
    ]);
    expect(workflowQueryKeys.list()).toEqual([
      'gitops',
      'workflows',
      'list',
      undefined,
    ]);
    expect(workflowQueryKeys.summary()).toEqual([
      'gitops',
      'workflows',
      'summary',
    ]);
    expect(workflowQueryKeys.detail(7)).toEqual([
      'gitops',
      'workflows',
      'detail',
      7,
    ]);
  });
});
