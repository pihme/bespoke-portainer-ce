import { buildUrl } from './build-url';

describe('REQ-TPL-03 buildUrl for custom templates API', () => {
  it('returns the custom templates collection path by default', () => {
    expect(buildUrl()).toBe('/custom_templates');
  });

  it('appends a template id', () => {
    expect(buildUrl({ id: 7 })).toBe('/custom_templates/7');
  });

  it('appends an action under a template id', () => {
    expect(buildUrl({ id: 7, action: 'file' })).toBe(
      '/custom_templates/7/file'
    );
  });

  it('appends an action without an id when only action is set', () => {
    expect(buildUrl({ action: 'create/string' })).toBe(
      '/custom_templates/create/string'
    );
  });
});
