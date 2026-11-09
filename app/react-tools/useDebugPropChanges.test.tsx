import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';

import { useDebugPropChanges } from './useDebugPropChanges';

function Probe({
  props,
  verbose,
}: {
  props: Record<string, unknown>;
  verbose?: boolean;
}) {
  useDebugPropChanges(props, verbose);
  return <div>probe</div>;
}

describe('useDebugPropChanges', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('logs Mounted on first render and verbose key diffs on update', () => {
    const { rerender } = render(
      <Probe props={{ a: 1, b: 'x' }} verbose />
    );
    expect(logSpy).toHaveBeenCalledWith('Mounted');

    logSpy.mockClear();
    rerender(<Probe props={{ a: 2, b: 'x' }} verbose />);

    expect(logSpy).toHaveBeenCalledWith('Key [', 'a', '] changed');
    expect(logSpy).toHaveBeenCalledWith('From: ', 1);
    expect(logSpy).toHaveBeenCalledWith('To:   ', 2);
    expect(logSpy).toHaveBeenCalledWith('------');
  });

  it('logs a compact changed-keys line when verbose is false', () => {
    const { rerender } = render(
      <Probe props={{ a: 1, b: 2 }} verbose={false} />
    );
    logSpy.mockClear();
    rerender(<Probe props={{ a: 1, b: 3 }} verbose={false} />);
    expect(logSpy).toHaveBeenCalledWith('Changed keys: ', 'b');
  });

  it('logs nothing when no tracked props change', () => {
    const { rerender } = render(<Probe props={{ a: 1 }} />);
    logSpy.mockClear();
    rerender(<Probe props={{ a: 1 }} />);
    expect(logSpy).not.toHaveBeenCalled();
  });
});
