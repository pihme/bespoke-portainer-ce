import { buildUrl } from './build-url';

describe('REQ-TPL-01 buildUrl for app templates API', () => {
  it('returns the templates collection path by default', () => {
    expect(buildUrl()).toBe('/templates');
  });

  it('appends a template id', () => {
    expect(buildUrl({ id: 12 })).toBe('/templates/12');
  });

  it('appends an action under a template id', () => {
    expect(buildUrl({ id: 12, action: 'file' })).toBe('/templates/12/file');
  });

  it('appends an action without an id when only action is set', () => {
    expect(buildUrl({ action: 'file' })).toBe('/templates/file');
  });
});
