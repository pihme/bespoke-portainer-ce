import { getDefaultImageConfig, getImageConfig } from './getImageConfig';

describe('REQ-IMG-02 getImageConfig', () => {
  it('returns a blank image config', () => {
    expect(getDefaultImageConfig()).toEqual({ image: '' });
  });

  it('REQ-TAI-005 keeps the full image name without matching registries', () => {
    expect(getImageConfig('registry.example.com/library/nginx:latest')).toEqual(
      { image: 'registry.example.com/library/nginx:latest' }
    );
  });
});
