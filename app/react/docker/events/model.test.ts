import { EventMessage } from 'docker-types';
import { describe, expect, it } from 'vitest';

import { createEventDetails } from './model';

function event(
  overrides: Partial<EventMessage> & {
    Actor?: {
      ID?: string;
      Attributes?: Record<string, string>;
    };
  } = {}
): EventMessage {
  return {
    Type: 'container',
    Action: 'start',
    Actor: {
      ID: 'actor-id',
      Attributes: { name: 'web', exitCode: '0' },
    },
    time: 1_700_000_000,
    ...overrides,
    Actor: {
      ID: overrides.Actor?.ID ?? 'actor-id',
      Attributes: {
        name: 'web',
        exitCode: '0',
        ...overrides.Actor?.Attributes,
      },
    },
  };
}

describe('REQ-HOST-05 createEventDetails', () => {
  describe('container actions', () => {
    const cases: Array<[string, string]> = [
      ['stop', 'Container web stopped'],
      ['destroy', 'Container web deleted'],
      ['create', 'Container web created'],
      ['start', 'Container web started'],
      ['kill', 'Container web killed'],
      ['die', 'Container web exited with status code 0'],
      ['commit', 'Container web committed'],
      ['restart', 'Container web restarted'],
      ['pause', 'Container web paused'],
      ['unpause', 'Container web unpaused'],
      ['attach', 'Container web attached'],
      ['detach', 'Container web detached'],
      ['copy', 'Container web copied'],
      ['export', 'Container web exported'],
      ['health_status', 'Container web executed health status'],
      ['oom', 'Container web goes in out of memory'],
      ['rename', 'Container web renamed'],
      ['resize', 'Container web resized'],
      ['top', 'Showed running processes for container web'],
      ['update', 'Container web updated'],
      ['exec_create', 'Exec instance created'],
      ['exec_start', 'Exec instance started'],
      ['exec_die', 'Exec instance exited'],
    ];

    it.each(cases)('formats %s', (action, expected) => {
      expect(createEventDetails(event({ Action: action }))).toBe(expected);
    });

    it('formats die with a non-zero exit code from actor attributes', () => {
      expect(
        createEventDetails(
          event({
            Action: 'die',
            Actor: { Attributes: { name: 'api', exitCode: '137' } },
          })
        )
      ).toBe('Container api exited with status code 137');
    });
  });

  describe('image actions', () => {
    const cases: Array<[string, string]> = [
      ['delete', 'Image deleted'],
      ['import', 'Image actor-id imported'],
      ['load', 'Image actor-id loaded'],
      ['tag', 'New tag created for web'],
      ['untag', 'Image untagged'],
      ['save', 'Image actor-id saved'],
      ['pull', 'Image actor-id pulled'],
      ['push', 'Image actor-id pushed'],
    ];

    it.each(cases)('formats %s', (action, expected) => {
      expect(
        createEventDetails(event({ Type: 'image', Action: action }))
      ).toBe(expected);
    });
  });

  describe('network actions', () => {
    const cases: Array<[string, string]> = [
      ['create', 'Network web created'],
      ['destroy', 'Network web deleted'],
      ['remove', 'Network web removed'],
      ['connect', 'Container connected to web network'],
      ['disconnect', 'Container disconnected from web network'],
      ['prune', 'Networks pruned'],
    ];

    it.each(cases)('formats %s', (action, expected) => {
      expect(
        createEventDetails(event({ Type: 'network', Action: action }))
      ).toBe(expected);
    });
  });

  describe('volume actions', () => {
    const cases: Array<[string, string]> = [
      ['create', 'Volume actor-id created'],
      ['destroy', 'Volume actor-id deleted'],
      ['mount', 'Volume actor-id mounted'],
      ['unmount', 'Volume actor-id unmounted'],
    ];

    it.each(cases)('formats %s', (action, expected) => {
      expect(
        createEventDetails(event({ Type: 'volume', Action: action }))
      ).toBe(expected);
    });
  });

  describe('action with colon suffix', () => {
    it('keeps the colon suffix on supported exec_create actions', () => {
      expect(
        createEventDetails(event({ Action: 'exec_create: sh' }))
      ).toBe('Exec instance created: sh');
    });

    it('keeps the colon suffix on unsupported actions', () => {
      expect(
        createEventDetails(
          event({ Type: 'container', Action: 'unknown: extra' })
        )
      ).toBe('Unsupported event: container / unknown: extra');
    });
  });

  describe('unsupported and missing fields', () => {
    it('reports unsupported event types with empty action maps', () => {
      for (const type of [
        'builder',
        'config',
        'daemon',
        'node',
        'plugin',
        'secret',
        'service',
      ] as const) {
        expect(
          createEventDetails(event({ Type: type, Action: 'create' }))
        ).toBe(`Unsupported event: ${type} / create`);
      }
    });

    it('reports completely unknown event types', () => {
      expect(
        createEventDetails(
          event({ Type: 'not-a-type' as EventMessage['Type'], Action: 'x' })
        )
      ).toBe('Unsupported event: not-a-type / x');
    });

    it('falls back when Type and Action are missing', () => {
      expect(
        createEventDetails({
          Actor: { ID: '', Attributes: {} },
        })
      ).toBe('Unsupported event:  / ');
    });

    it('uses empty strings when Actor attributes are absent', () => {
      expect(
        createEventDetails({
          Type: 'container',
          Action: 'start',
        })
      ).toBe('Container  started');
    });

    it('uses empty id when Actor.ID is missing for image pull', () => {
      expect(
        createEventDetails({
          Type: 'image',
          Action: 'pull',
          Actor: { Attributes: {} },
        })
      ).toBe('Image  pulled');
    });
  });
});
