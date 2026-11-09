import { describe, expect, it } from 'vitest';

import {
  getTemplateVariables,
  intersectVariables,
  renderTemplate,
} from './utils';

describe('custom template utils for local Compose', () => {
  it('getTemplateVariables parses mustache names and reports parse errors', () => {
    expect(getTemplateVariables('')).toEqual([[], null]);
    const [vars, err] = getTemplateVariables(
      'image: {{ image_name }}\nname: {{ stack_name }}'
    );
    expect(err).toBeNull();
    expect(vars?.map((v) => v.name)).toEqual(
      expect.arrayContaining(['image_name', 'stack_name'])
    );

    const [bad, badErr] = getTemplateVariables('{{#unclosed');
    expect(bad).toBeNull();
    expect(badErr).toBeTruthy();
  });

  it('intersectVariables keeps labeled old vars and adds new ones', () => {
    const result = intersectVariables(
      [
        { name: 'a', label: 'A', defaultValue: '', description: '' },
        { name: 'b', label: '', defaultValue: '', description: '' },
      ],
      [
        { name: 'a', label: 'A2', defaultValue: 'x', description: '' },
        { name: 'c', label: 'C', defaultValue: '', description: '' },
      ]
    );
    expect(result.map((v) => v.name)).toEqual(['a', 'c']);
    expect(result[0].label).toBe('A');
  });

  it('renderTemplate fills values defaults and unresolved placeholders', () => {
    const template = 'hello {{ name }} / {{ missing }} / {{ empty }}';
    const out = renderTemplate(
      template,
      [
        { key: 'name', value: 'world' },
        { key: 'missing', value: '' },
        { key: 'empty', value: '' },
      ],
      [
        { name: 'empty', label: 'E', defaultValue: 'fallback', description: '' },
      ]
    );
    expect(out).toContain('hello world');
    expect(out).toContain('fallback');
    expect(out).toBe('hello world /  / fallback');
  });
});
