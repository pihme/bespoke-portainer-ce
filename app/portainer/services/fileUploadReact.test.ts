import { describe, expect, it } from 'vitest';

import { readFileAsArrayBuffer, readFileAsText } from './fileUploadReact';

describe('REQ-STK-02 fileUploadReact readers', () => {
  it('readFileAsText returns file contents', async () => {
    const file = new File(['hello compose'], 'docker-compose.yml', { type: 'text/plain' });
    await expect(readFileAsText(file)).resolves.toBe('hello compose');
  });

  it('readFileAsArrayBuffer returns an ArrayBuffer', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'bin');
    const buf = await readFileAsArrayBuffer(file);
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(buf as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3]));
  });
});
