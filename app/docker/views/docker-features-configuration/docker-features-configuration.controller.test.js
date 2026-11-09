import { beforeEach, describe, expect, it, vi } from 'vitest';

import DockerFeaturesConfigurationController from './docker-features-configuration.controller';

function securitySettings(overrides = {}) {
  return {
    enableHostManagementFeatures: false,
    allowVolumeBrowserForRegularUsers: false,
    allowBindMountsForRegularUsers: true,
    allowPrivilegedModeForRegularUsers: true,
    allowHostNamespaceForRegularUsers: true,
    allowDeviceMappingForRegularUsers: true,
    allowStackManagementForRegularUsers: true,
    allowContainerCapabilitiesForRegularUsers: true,
    allowSysctlSettingForRegularUsers: true,
    allowSecurityOptForRegularUsers: true,
    ...overrides,
  };
}

function buildController(options = {}) {
  const {
    endpoint = {
      Id: 5,
      Name: 'local',
      SecuritySettings: securitySettings(),
      Gpus: [],
      EnableGPUManagement: false,
    },
    agentProxy = false,
    provider = 'DOCKER_STANDALONE',
    updateResult = undefined,
    updateError = null,
  } = options;

  const $scope = {
    $evalAsync: (fn) => fn(),
  };
  const $state = { reload: vi.fn() };
  const Notifications = { success: vi.fn(), error: vi.fn() };
  const StateManager = {
    getState: vi.fn(() => ({
      endpoint: { mode: { agentProxy, provider } },
    })),
  };

  let updateResolve;
  let updateReject;
  const updatePromise = new Promise((res, rej) => {
    updateResolve = res;
    updateReject = rej;
  });

  const EndpointService = {
    updateSecuritySettings: vi.fn(() => updatePromise),
  };
  const SettingsService = {};

  const $async = (fn, ...args) => Promise.resolve().then(() => fn(...args));

  const ctrl = new DockerFeaturesConfigurationController(
    $async,
    $scope,
    $state,
    EndpointService,
    SettingsService,
    Notifications,
    StateManager
  );
  ctrl.endpoint = structuredClone(endpoint);

  async function settleSave() {
    if (updateError) {
      updateReject(updateError);
    } else {
      updateResolve(updateResult);
    }
    await updatePromise.catch(() => undefined);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  return {
    ctrl,
    $scope,
    $state,
    Notifications,
    StateManager,
    EndpointService,
    settleSave,
    updateError,
  };
}

describe('REQ-HOST-04 DockerFeaturesConfigurationController local Docker feature flags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes form values from security settings for a non-agent standalone host', () => {
    const { ctrl, StateManager } = buildController({
      endpoint: {
        Id: 5,
        SecuritySettings: securitySettings({
          allowBindMountsForRegularUsers: false,
          allowPrivilegedModeForRegularUsers: false,
        }),
        Gpus: null,
        EnableGPUManagement: false,
      },
      agentProxy: false,
      provider: 'DOCKER_STANDALONE',
    });

    ctrl.$onInit();

    expect(StateManager.getState).toHaveBeenCalled();
    expect(ctrl.isAgent).toBe(false);
    expect(ctrl.isDockerStandaloneEnv).toBe(true);
    expect(ctrl.formValues.enableHostManagementFeatures).toBe(false);
    expect(ctrl.formValues.allowVolumeBrowserForRegularUsers).toBe(false);
    expect(ctrl.formValues.disableBindMountsForRegularUsers).toBe(true);
    expect(ctrl.formValues.disablePrivilegedModeForRegularUsers).toBe(true);
    expect(ctrl.endpoint.Gpus).toEqual([]);
    expect(ctrl.state.enableGPUManagement).toBe(false);
    expect(ctrl.initialGPUs).toEqual([]);
    expect(ctrl.initialEnableGPUManagement).toBe(false);
  });

  it('enables agent-only host toggles and GPU management when GPUs exist', () => {
    const { ctrl } = buildController({
      endpoint: {
        Id: 5,
        SecuritySettings: securitySettings({
          enableHostManagementFeatures: true,
          allowVolumeBrowserForRegularUsers: true,
        }),
        Gpus: [{ name: 'nvidia0', value: 'gpu=0' }],
        EnableGPUManagement: false,
      },
      agentProxy: true,
      provider: 'DOCKER_STANDALONE',
    });

    ctrl.$onInit();

    expect(ctrl.isAgent).toBe(true);
    expect(ctrl.formValues.enableHostManagementFeatures).toBe(true);
    expect(ctrl.formValues.allowVolumeBrowserForRegularUsers).toBe(true);
    expect(ctrl.state.enableGPUManagement).toBe(true);
    expect(ctrl.initialGPUs).toEqual([{ name: 'nvidia0', value: 'gpu=0' }]);
  });

  it('leaves GPU management off on non-standalone providers even with GPUs', () => {
    const { ctrl } = buildController({
      endpoint: {
        Id: 5,
        SecuritySettings: securitySettings(),
        Gpus: [{ name: 'nvidia0', value: 'gpu=0' }],
        EnableGPUManagement: true,
      },
      provider: 'DOCKER_SWARM_MODE',
    });

    ctrl.$onInit();
    expect(ctrl.isDockerStandaloneEnv).toBe(false);
    expect(ctrl.state.enableGPUManagement).toBe(false);
  });

  it('toggles auto-update, GPU management, and individual form fields', () => {
    const { ctrl } = buildController();
    ctrl.$onInit();

    ctrl.onToggleAutoUpdate(true);
    expect(ctrl.state.autoUpdateSettings.Enabled).toBe(true);

    ctrl.onToggleGPUManagement(true);
    expect(ctrl.state.enableGPUManagement).toBe(true);

    ctrl.onChangeDisableBindMountsForRegularUsers(true);
    expect(ctrl.formValues.disableBindMountsForRegularUsers).toBe(true);

    ctrl.onChangeAllowVolumeBrowserForRegularUsers(true);
    expect(ctrl.formValues.allowVolumeBrowserForRegularUsers).toBe(true);

    ctrl.onChangeEnableHostManagementFeatures(true);
    expect(ctrl.formValues.enableHostManagementFeatures).toBe(true);

    ctrl.onChangeDisablePrivilegedModeForRegularUsers(true);
    ctrl.onChangeDisableHostNamespaceForRegularUsers(true);
    ctrl.onChangeDisableStackManagementForRegularUsers(true);
    ctrl.onChangeDisableDeviceMappingForRegularUsers(true);
    ctrl.onChangeDisableContainerCapabilitiesForRegularUsers(true);
    ctrl.onChangeDisableSysctlSettingForRegularUsers(true);
    ctrl.onChangeDisableSecurityOptForRegularUsers(true);

    expect(ctrl.formValues.disablePrivilegedModeForRegularUsers).toBe(true);
    expect(ctrl.formValues.disableHostNamespaceForRegularUsers).toBe(true);
    expect(ctrl.formValues.disableStackManagementForRegularUsers).toBe(true);
    expect(ctrl.formValues.disableDeviceMappingForRegularUsers).toBe(true);
    expect(ctrl.formValues.disableContainerCapabilitiesForRegularUsers).toBe(true);
    expect(ctrl.formValues.disableSysctlSettingForRegularUsers).toBe(true);
    expect(ctrl.formValues.disableSecurityOptForRegularUsers).toBe(true);
  });

  it('updates endpoint GPUs through onGpusChange', async () => {
    const { ctrl } = buildController();
    ctrl.$onInit();
    await ctrl.onGpusChange([{ name: 'gpu0', value: '0' }]);
    expect(ctrl.endpoint.Gpus).toEqual([{ name: 'gpu0', value: '0' }]);
  });

  it('isContainerEditDisabled is true when any container-edit restriction is set', () => {
    const { ctrl } = buildController();
    ctrl.$onInit();
    expect(ctrl.isContainerEditDisabled()).toBe(false);

    ctrl.formValues.disableSysctlSettingForRegularUsers = true;
    expect(ctrl.isContainerEditDisabled()).toBe(true);

    ctrl.formValues.disableSysctlSettingForRegularUsers = false;
    ctrl.formValues.disableBindMountsForRegularUsers = true;
    expect(ctrl.isContainerEditDisabled()).toBe(true);
  });

  it('saves inverted allow-* security settings and filters invalid GPUs when GPU management is on', async () => {
    const { ctrl, EndpointService, Notifications, $state, settleSave } = buildController();
    ctrl.$onInit();
    ctrl.state.enableGPUManagement = true;
    ctrl.endpoint.Gpus = [
      { name: 'ok', value: '0' },
      { name: '', value: '1' },
      { name: 'bad', value: '' },
    ];
    ctrl.formValues.disableBindMountsForRegularUsers = true;
    ctrl.formValues.disablePrivilegedModeForRegularUsers = true;
    ctrl.formValues.disableHostNamespaceForRegularUsers = true;
    ctrl.formValues.disableDeviceMappingForRegularUsers = true;
    ctrl.formValues.disableStackManagementForRegularUsers = true;
    ctrl.formValues.disableContainerCapabilitiesForRegularUsers = true;
    ctrl.formValues.disableSysctlSettingForRegularUsers = true;
    ctrl.formValues.disableSecurityOptForRegularUsers = true;
    ctrl.formValues.enableHostManagementFeatures = true;
    ctrl.formValues.allowVolumeBrowserForRegularUsers = true;

    const savePromise = ctrl.save();
    await Promise.resolve();
    expect(ctrl.state.actionInProgress).toBe(true);
    await settleSave();
    await savePromise;

    expect(EndpointService.updateSecuritySettings).toHaveBeenCalledWith(5, {
      enableHostManagementFeatures: true,
      allowBindMountsForRegularUsers: false,
      allowPrivilegedModeForRegularUsers: false,
      allowVolumeBrowserForRegularUsers: true,
      allowHostNamespaceForRegularUsers: false,
      allowDeviceMappingForRegularUsers: false,
      allowStackManagementForRegularUsers: false,
      allowContainerCapabilitiesForRegularUsers: false,
      allowSysctlSettingForRegularUsers: false,
      allowSecurityOptForRegularUsers: false,
      enableGPUManagement: true,
      gpus: [{ name: 'ok', value: '0' }],
    });
    expect(ctrl.endpoint.SecuritySettings.gpus).toEqual([{ name: 'ok', value: '0' }]);
    expect(ctrl.initialGPUs).toEqual([{ name: 'ok', value: '0' }]);
    expect(ctrl.initialEnableGPUManagement).toBe(true);
    expect(Notifications.success).toHaveBeenCalledWith('Success', 'Saved settings successfully');
    expect(ctrl.state.actionInProgress).toBe(false);
    expect($state.reload).toHaveBeenCalled();
  });

  it('clears GPUs on save when GPU management is disabled', async () => {
    const { ctrl, EndpointService, settleSave } = buildController();
    ctrl.$onInit();
    ctrl.state.enableGPUManagement = false;
    ctrl.endpoint.Gpus = [{ name: 'ok', value: '0' }];

    const savePromise = ctrl.save();
    await settleSave();
    await savePromise;

    expect(EndpointService.updateSecuritySettings.mock.calls[0][1].gpus).toEqual([]);
    expect(EndpointService.updateSecuritySettings.mock.calls[0][1].enableGPUManagement).toBe(false);
  });

  it('notifies failure and still reloads when save errors', async () => {
    const err = new Error('save failed');
    const { ctrl, Notifications, $state, settleSave } = buildController({ updateError: err });
    ctrl.$onInit();

    const savePromise = ctrl.save();
    await settleSave();
    await savePromise;

    expect(Notifications.error).toHaveBeenCalledWith('Failure', err, 'Failed saving settings');
    expect(Notifications.success).not.toHaveBeenCalled();
    expect(ctrl.state.actionInProgress).toBe(false);
    expect($state.reload).toHaveBeenCalled();
  });
});
