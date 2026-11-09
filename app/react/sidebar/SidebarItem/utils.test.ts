import { createElement } from 'react';

import { getPaths } from './utils';

describe('getPaths', () => {
  it('returns paths unchanged for non-element nodes', () => {
    expect(getPaths(null, ['a'])).toEqual(['a']);
    expect(getPaths('text', ['a'])).toEqual(['a']);
  });

  it('collects to prop from an element', () => {
    const el = createElement('a', { to: 'docker.containers' });
    expect(getPaths(el, [])).toEqual(['docker.containers']);
  });

  it('walks children when to is undefined', () => {
    const child = createElement('a', { to: 'docker.images' });
    const parent = createElement('div', {}, child);
    expect(getPaths(parent, [])).toEqual(['docker.images']);
  });
});
