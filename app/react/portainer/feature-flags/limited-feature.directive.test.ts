import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Edition, FeatureId, FeatureState } from './enums';
import { init } from './feature-flags.service';
import { limitedFeatureDirective } from './limited-feature.directive';

describe('limitedFeatureDirective', () => {
  beforeEach(async () => {
    await init(Edition.CE);
  });

  it('does nothing without a feature id', () => {
    const link = limitedFeatureDirective().link as Function;
    const elem = { hide: vi.fn(), attr: vi.fn() };
    link({}, elem, {});
    expect(elem.hide).not.toHaveBeenCalled();
  });

  it('hides the element for unknown features', () => {
    const link = limitedFeatureDirective().link as Function;
    const elem = { hide: vi.fn(), attr: vi.fn() };
    link({}, elem, { limitedFeatureDir: 'missing' });
    expect(elem.hide).toHaveBeenCalled();
  });

  it('appends limited-feature attributes for BE-limited features', async () => {
    const link = limitedFeatureDirective().link as Function;
    const attrsStore: Record<string, string> = {};
    const elem = {
      hide: vi.fn(),
      attr: vi.fn((name: string, value?: string) => {
        if (value === undefined) return attrsStore[name] || '';
        attrsStore[name] = value;
        return elem;
      }),
    };
    link(
      {},
      elem,
      {
        limitedFeatureDir: FeatureId.CONTAINER_WEBHOOK,
        limitedFeatureDisabled: 'disabled',
        limitedFeatureClass: 'be-only',
      }
    );
    expect(elem.hide).not.toHaveBeenCalled();
    expect(elem.attr).toHaveBeenCalled();
    expect(String(attrsStore.disabled || attrsStore.class || '')).toMatch(
      /disabled|be-only/
    );
  });

  it('leaves visible features alone under BE edition', async () => {
    await init(Edition.BE);
    const link = limitedFeatureDirective().link as Function;
    const elem = { hide: vi.fn(), attr: vi.fn() };
    link({}, elem, { limitedFeatureDir: FeatureId.CONTAINER_WEBHOOK });
    expect(elem.hide).not.toHaveBeenCalled();
    expect(elem.attr).not.toHaveBeenCalled();
  });
});
