import { describe, it, expect, beforeEach } from 'vitest';

import { keyBuilder } from './useLocalStorage';
import { environmentStore } from './current-environment-store';

describe('environmentStore', () => {
  beforeEach(() => {
    sessionStorage.clear();
    environmentStore.setState({ environmentId: undefined });
  });

  it('sets and clears the environment id', () => {
    environmentStore.getState().setEnvironmentId(3);
    expect(environmentStore.getState().environmentId).toBe(3);

    environmentStore.getState().clear();
    expect(environmentStore.getState().environmentId).toBeUndefined();
  });

  it('persists the id in sessionStorage under the portainer key', () => {
    environmentStore.getState().setEnvironmentId(9);

    const raw = sessionStorage.getItem(keyBuilder('environmentId'));
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.environmentId).toBe(9);
  });
});
