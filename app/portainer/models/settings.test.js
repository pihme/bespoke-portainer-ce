import { describe, it, expect } from 'vitest';

import {
  SettingsViewModel,
  PublicSettingsViewModel,
  EdgeSettingsViewModel,
} from './settings';

describe('REQ-SET-01 SettingsViewModel mapping', () => {
  it('maps logo, snapshot interval and feature fields from settings', () => {
    const vm = new SettingsViewModel({
      LogoURL: 'https://example.com/logo.png',
      BlackListedLabels: [{ name: 'com.docker.compose.project' }],
      SnapshotInterval: '5m',
      TemplatesURL: 'https://templates.example/templates.json',
      EdgeAgentCheckinInterval: 5,
      EnableEdgeComputeFeatures: false,
      FeatureFlagSettings: { flag: true },
      KubeconfigExpiry: '24h',
      HelmRepositoryURL: 'https://charts.example',
      TrustOnFirstConnect: false,
      EnforceEdgeID: false,
      AgentSecret: 'agent-secret',
      EdgePortainerUrl: 'https://portainer.example',
    });

    expect(vm.LogoURL).toBe('https://example.com/logo.png');
    expect(vm.BlackListedLabels).toEqual([{ name: 'com.docker.compose.project' }]);
    expect(vm.SnapshotInterval).toBe('5m');
    expect(vm.TemplatesURL).toBe('https://templates.example/templates.json');
    expect(vm.EnableEdgeComputeFeatures).toBe(false);
    expect(vm.AgentSecret).toBe('agent-secret');
  });
});

describe('REQ-SET-01 PublicSettingsViewModel mapping', () => {
  it('maps public logo and nested Edge settings', () => {
    const vm = new PublicSettingsViewModel({
      EnableEdgeComputeFeatures: true,
      EnforceEdgeID: true,
      LogoURL: '/logo.png',
      KubeconfigExpiry: '1h',
      Features: { something: true },
      Edge: {
        CheckinInterval: 5,
        PingInterval: 60,
        SnapshotInterval: 300,
        CommandInterval: 10,
      },
      DefaultRegistry: { HideDefaultRegistry: false },
    });

    expect(vm.LogoURL).toBe('/logo.png');
    expect(vm.Edge).toBeInstanceOf(EdgeSettingsViewModel);
    expect(vm.Edge.CheckinInterval).toBe(5);
    expect(vm.Edge.PingInterval).toBe(60);
    expect(vm.DefaultRegistry).toEqual({ HideDefaultRegistry: false });
  });
});

describe('backwards compatibility: EdgeSettingsViewModel defaults', () => {
  it('defaults missing Edge intervals to undefined when constructed empty', () => {
    const vm = new EdgeSettingsViewModel();
    expect(vm.CheckinInterval).toBeUndefined();
    expect(vm.PingInterval).toBeUndefined();
    expect(vm.SnapshotInterval).toBeUndefined();
    expect(vm.CommandInterval).toBeUndefined();
  });
});

describe('REQ-TAI-001 settings view models carry no login fields', () => {
  it('drops authentication, LDAP, OAuth and session fields', () => {
    const vm = new SettingsViewModel({
      AuthenticationMethod: 2,
      LDAPSettings: { URL: 'ldap://x' },
      OAuthSettings: { ClientID: 'c' },
      UserSessionTimeout: '8h',
    });
    expect(vm).not.toHaveProperty('AuthenticationMethod');
    expect(vm).not.toHaveProperty('LDAPSettings');
    expect(vm).not.toHaveProperty('OAuthSettings');
    expect(vm).not.toHaveProperty('UserSessionTimeout');

    const pub = new PublicSettingsViewModel({
      AuthenticationMethod: 1,
      OAuthLoginURI: '/x',
      RequiresSetupToken: true,
    });
    expect(pub).not.toHaveProperty('AuthenticationMethod');
    expect(pub).not.toHaveProperty('OAuthLoginURI');
    expect(pub).not.toHaveProperty('RequiresSetupToken');
  });
});
