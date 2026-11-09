import { describe, expect, it } from 'vitest';

import { VolumesCIFSFormData } from './volumesCifsFormModel';

describe('VolumesCIFSFormData', () => {
  it('initializes CIFS defaults and version catalogs', () => {
    const data = new VolumesCIFSFormData();
    expect(data.useCIFS).toBe(false);
    expect(data.serverAddress).toBe('');
    expect(data.share).toBe('');
    expect(data.version).toContain('CIFS v2.0');
    expect(data.versions).toHaveLength(4);
    expect(data.versionsNumber).toEqual(['1.0', '2.0', '2.1', '3.0']);
    expect(data.username).toBe('');
    expect(data.password).toBe('');
  });
});
