import { describe, expect, it } from 'vitest';

import { buildOption } from './utils';

describe('buildOption', () => {
  it('builds a box selector option without a feature gate', () => {
    expect(
      buildOption('docker', 'box', 'Docker', 'Local engine', 'docker')
    ).toEqual({
      id: 'docker',
      icon: 'box',
      label: 'Docker',
      description: 'Local engine',
      value: 'docker',
    });
  });

  it('REQ-TAI-018 carries no Business Edition feature id', () => {
    expect(buildOption('x', 'box', 'X', 'desc', 1)).not.toHaveProperty(
      'feature'
    );
  });
});
