import { beforeEach, describe, expect, it, vi } from 'vitest';

const { notifySuccess, notifyError, invalidateQueries } = vi.hoisted(() => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: (...args) => notifySuccess(...args),
  notifyError: (...args) => notifyError(...args),
}));

vi.mock('@/react-tools/react-query', () => ({
  queryClient: { invalidateQueries },
}));

vi.mock('@/portainer/users/queries/queryKeys', () => ({
  userQueryKeys: { base: () => ['users'] },
}));

vi.mock('@/react/portainer/account/AccountView/theme-options', () => ({
  options: [
    { id: 'auto', label: 'Auto', value: 'auto' },
    { id: 'dark', label: 'Dark', value: 'dark' },
    { id: 'light', label: 'Light', value: 'light' },
  ],
}));

import ThemeSettingsController from './theme-settings.controller';

function buildController(options = {}) {
  const {
    userId = 7,
    userTheme = { color: 'dark' },
    userError = null,
    updateError = null,
  } = options;

  const Authentication = {
    getUserDetails: vi.fn(() => ({ ID: userId })),
  };
  const ThemeManager = {
    autoTheme: vi.fn(),
    setTheme: vi.fn(),
  };
  const StateManager = {};
  const UserService = {
    user: vi.fn(() =>
      userError ? Promise.reject(userError) : Promise.resolve({ ThemeSettings: userTheme })
    ),
    updateUserTheme: vi.fn(() =>
      updateError ? Promise.reject(updateError) : Promise.resolve()
    ),
  };
  const $async = (fn, ...args) => Promise.resolve().then(() => fn(...args));

  const ctrl = new ThemeSettingsController(
    $async,
    Authentication,
    ThemeManager,
    StateManager,
    UserService
  );

  return { ctrl, Authentication, ThemeManager, UserService };
}

describe('REQ-SET-01 ThemeSettingsController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the current user theme on init', async () => {
    const { ctrl, Authentication, UserService } = buildController({
      userTheme: { color: 'light' },
    });

    await ctrl.$onInit();

    expect(Authentication.getUserDetails).toHaveBeenCalled();
    expect(UserService.user).toHaveBeenCalledWith(7);
    expect(ctrl.state.userId).toBe(7);
    expect(ctrl.state.themeColor).toBe('light');
    expect(ctrl.state.availableThemes).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: 'auto' })])
    );
  });

  it('falls back to auto when the user has no theme color', async () => {
    const { ctrl } = buildController({ userTheme: {} });
    await ctrl.$onInit();
    expect(ctrl.state.themeColor).toBe('auto');
  });

  it('notifies when user details cannot be loaded', async () => {
    const err = new Error('no user');
    const { ctrl } = buildController({ userError: err });
    await ctrl.$onInit();
    expect(notifyError).toHaveBeenCalledWith(
      'Failure',
      err,
      'Unable to get user details'
    );
  });

  it('applies an explicit theme color and persists it', async () => {
    const { ctrl, ThemeManager, UserService } = buildController();
    await ctrl.$onInit();

    await ctrl.setThemeColor('dark');

    expect(ThemeManager.setTheme).toHaveBeenCalledWith('dark');
    expect(ThemeManager.autoTheme).not.toHaveBeenCalled();
    expect(ctrl.state.themeColor).toBe('dark');
    expect(UserService.updateUserTheme).toHaveBeenCalledWith(7, { color: 'dark' });
    expect(invalidateQueries).toHaveBeenCalledWith(['users']);
    expect(notifySuccess).toHaveBeenCalledWith(
      'Success',
      'User theme settings successfully updated'
    );
  });

  it('uses autoTheme for auto or empty color', async () => {
    const { ctrl, ThemeManager } = buildController();
    await ctrl.$onInit();

    await ctrl.setThemeColor('auto');
    expect(ThemeManager.autoTheme).toHaveBeenCalled();

    ThemeManager.autoTheme.mockClear();
    await ctrl.setThemeColor('');
    expect(ThemeManager.autoTheme).toHaveBeenCalled();
  });

  it('notifies when persisting theme settings fails', async () => {
    const err = new Error('save failed');
    const { ctrl } = buildController({ updateError: err });
    await ctrl.$onInit();
    await ctrl.setThemeColor('dark');
    expect(notifyError).toHaveBeenCalledWith(
      'Failure',
      err,
      'Unable to update user theme settings'
    );
  });
});
