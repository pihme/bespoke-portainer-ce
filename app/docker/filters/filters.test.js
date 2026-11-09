import { describe, expect, it, vi } from 'vitest';

const { filterFns, moduleApi, angularMock } = vi.hoisted(() => {
  const filterFns = {};
  const moduleApi = {
    filter: vi.fn((name, factory) => {
      filterFns[name] = factory;
      return moduleApi;
    }),
  };
  const angularMock = {
    module: vi.fn(() => moduleApi),
  };
  globalThis.angular = angularMock;
  return { filterFns, moduleApi, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

await import('./filters.js');

function filter(name) {
  const factory = filterFns[name];
  expect(factory, `missing filter ${name}`).toBeDefined();
  return typeof factory === 'function' ? factory() : factory;
}

describe('REQ-CTR-01 local Docker Angular list filters', () => {
  it('registers keepable local filters on the portainer.docker module', () => {
    expect(Object.keys(filterFns).sort()).toEqual(
      expect.arrayContaining([
        'containerstatusbadge',
        'trimcontainername',
        'getstatelabel',
        'containername',
        'repotags',
        'command',
        'hideshasum',
        'imagelayercommand',
        'trimshasum',
        'trimversiontag',
        'unique',
      ])
    );
  });

  describe('containerstatusbadge', () => {
    const badge = () => filter('containerstatusbadge');

    it('maps paused, starting and unhealthy to warning', () => {
      expect(badge()('Paused')).toBe('warning');
      expect(badge()('starting')).toBe('warning');
      expect(badge()('unhealthy')).toBe('warning');
    });

    it('maps created to info', () => {
      expect(badge()('Created')).toBe('info');
    });

    it('maps stopped, dead and exited to danger', () => {
      expect(badge()('stopped')).toBe('danger');
      expect(badge()('dead')).toBe('danger');
      expect(badge()('exited')).toBe('danger');
    });

    it('maps running and other statuses to success', () => {
      expect(badge()('running')).toBe('success');
      expect(badge()('healthy')).toBe('success');
    });
  });

  describe('getstatelabel', () => {
    const label = () => filter('getstatelabel');

    it('returns label-default when state is undefined', () => {
      expect(label()(undefined)).toBe('label-default');
    });

    it('returns label-important for a ghost running container', () => {
      expect(label()({ Ghost: true, Running: true })).toBe('label-important');
    });

    it('returns label-success for a running container', () => {
      expect(label()({ Running: true })).toBe('label-success');
    });

    it('returns label-default when not running', () => {
      expect(label()({ Running: false })).toBe('label-default');
      expect(label()({ Ghost: true, Running: false })).toBe('label-default');
    });
  });

  describe('containername', () => {
    it('returns the first Docker Names entry', () => {
      expect(filter('containername')({ Names: ['/web', '/alias'] })).toBe(
        '/web'
      );
    });
  });

  describe('repotags', () => {
    const tags = () => filter('repotags');

    it('returns RepoTags when present and not the none placeholder', () => {
      expect(tags()({ RepoTags: ['nginx:latest', 'nginx:1'] })).toEqual([
        'nginx:latest',
        'nginx:1',
      ]);
    });

    it('returns empty for <none>:<none>', () => {
      expect(tags()({ RepoTags: ['<none>:<none>'] })).toEqual([]);
    });

    it('returns empty when RepoTags is missing or empty', () => {
      expect(tags()({})).toEqual([]);
      expect(tags()({ RepoTags: [] })).toEqual([]);
    });
  });

  describe('command', () => {
    it('joins argv the same way as joinCommand', () => {
      expect(filter('command')(['echo', 'hi'])).toBe('echo hi');
      expect(filter('command')(null)).toBe('');
    });
  });

  describe('hideshasum', () => {
    it('strips digest suffixes for display', () => {
      expect(filter('hideshasum')('img@sha256:ff')).toBe('img');
    });
  });

  describe('imagelayercommand', () => {
    const layer = () => filter('imagelayercommand');

    it('returns empty for falsy createdBy', () => {
      expect(layer()(undefined)).toBe('');
      expect(layer()('')).toBe('');
    });

    it('strips the nop shell prefix', () => {
      expect(layer()('/bin/sh -c #(nop) ENV PATH=/usr/bin')).toBe(
        'ENV PATH=/usr/bin'
      );
    });

    it('rewrites a plain shell command as RUN', () => {
      expect(layer()('/bin/sh -c apt-get update')).toBe('RUN apt-get update');
    });
  });

  describe('trimshasum and trimversiontag', () => {
    it('delegate to the shared utils helpers', () => {
      expect(filter('trimshasum')('sha256:0123456789abcdef0123456789abcdef')).toBe(
        '0123456789ab'
      );
      expect(filter('trimversiontag')('nginx:1.25')).toBe('nginx');
    });
  });

  describe('trimcontainername', () => {
    it('strips the leading slash from container names', () => {
      expect(filter('trimcontainername')('/api')).toBe('api');
    });
  });

  describe('unique', () => {
    it('exposes lodash uniqBy for list display', () => {
      const uniqBy = filter('unique');
      expect(
        uniqBy(
          [
            { Id: '1', Name: 'a' },
            { Id: '1', Name: 'b' },
            { Id: '2', Name: 'c' },
          ],
          'Id'
        )
      ).toEqual([
        { Id: '1', Name: 'a' },
        { Id: '2', Name: 'c' },
      ]);
    });
  });
});
