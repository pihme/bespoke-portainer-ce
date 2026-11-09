import { describe, expect, it } from 'vitest';

import { getDefaultModel, toGitFormModel } from './types';

describe('gitops form model helpers (backwards compatibility)', () => {
  it('getDefaultModel returns compose defaults with optional auto-update override', () => {
    const defaults = getDefaultModel();
    expect(defaults).toMatchObject({
      ComposeFilePathInRepository: 'docker-compose.yml',
      RepositoryReferenceName: 'refs/heads/main',
      SourceId: 0,
    });
    expect(defaults.AutoUpdate).toMatchObject({
      RepositoryAutomaticUpdates: false,
    });

    const custom = getDefaultModel({
      RepositoryAutomaticUpdates: true,
      RepositoryAutomaticUpdatesForce: true,
      ForcePullImage: true,
    });
    expect(custom.AutoUpdate?.RepositoryAutomaticUpdates).toBe(true);
  });

  it('toGitFormModel falls back to defaults when response is missing', () => {
    expect(toGitFormModel(3)).toMatchObject({
      ComposeFilePathInRepository: 'docker-compose.yml',
      SourceId: 0,
    });
  });

  it('toGitFormModel maps repo response fields onto the form model', () => {
    const model = toGitFormModel(
      9,
      {
        ReferenceName: 'refs/heads/develop',
        ConfigFilePath: 'compose.yml',
      },
      {
        RepositoryAutomaticUpdates: true,
        RepositoryAutomaticUpdatesForce: false,
        ForcePullImage: false,
      }
    );
    expect(model).toEqual({
      ComposeFilePathInRepository: 'compose.yml',
      RepositoryReferenceName: 'refs/heads/develop',
      AutoUpdate: {
        RepositoryAutomaticUpdates: true,
        RepositoryAutomaticUpdatesForce: false,
        ForcePullImage: false,
      },
      SourceId: 9,
    });
  });
});
