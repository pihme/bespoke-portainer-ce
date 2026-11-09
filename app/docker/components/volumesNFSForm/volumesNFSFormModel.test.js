import { describe, expect, it } from 'vitest';

import { VolumesNFSFormData } from './volumesNFSFormModel';

describe('VolumesNFSFormData', () => {
  it('initializes NFS defaults and version catalog', () => {
    const data = new VolumesNFSFormData();
    expect(data.useNFS).toBe(false);
    expect(data.serverAddress).toBe('');
    expect(data.mountPoint).toBe('');
    expect(data.version).toBe('NFS4');
    expect(data.options).toBe('rw,noatime,rsize=8192,wsize=8192,tcp,timeo=14');
    expect(data.versions).toEqual(['NFS4', 'NFS']);
  });
});
