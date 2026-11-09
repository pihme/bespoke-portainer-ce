import { describe, it, expect } from 'vitest';

import {
  SettingsViewModel,
  PublicSettingsViewModel,
  InternalAuthSettingsViewModel,
  LDAPSettingsViewModel,
  LDAPSearchSettings,
  LDAPGroupSearchSettings,
  OAuthSettingsViewModel,
  EdgeSettingsViewModel,
} from './settings';

describe('REQ-SET-01 SettingsViewModel mapping', () => {
  it('maps logo, auth method, snapshot interval and feature fields from settings', () => {
    const vm = new SettingsViewModel({
      LogoURL: 'https://example.com/logo.png',
      BlackListedLabels: [{ name: 'com.docker.compose.project' }],
      AuthenticationMethod: 1,
      InternalAuthSettings: { RequiredPasswordLength: 12 },
      LDAPSettings: {
        ReaderDN: 'cn=reader',
        Password: 'secret',
        URL: 'ldap://ldap.example',
        SearchSettings: [],
        GroupSearchSettings: [],
        AutoCreateUsers: true,
      },
      OAuthSettings: {
        ClientID: 'cid',
        ClientSecret: 'csecret',
        AccessTokenURI: 'https://idp/token',
        AuthorizationURI: 'https://idp/auth',
        ResourceURI: 'https://idp/user',
        RedirectURI: 'https://portainer/oauth/callback',
        UserIdentifier: 'email',
        Scopes: 'openid',
        OAuthAutoCreateUsers: false,
        DefaultTeamID: 0,
        SSO: true,
        LogoutURI: 'https://idp/logout',
        AuthStyle: 0,
      },
      SnapshotInterval: '5m',
      TemplatesURL: 'https://templates.example/templates.json',
      EdgeAgentCheckinInterval: 5,
      EnableEdgeComputeFeatures: false,
      FeatureFlagSettings: { flag: true },
      UserSessionTimeout: '8h',
      KubeconfigExpiry: '24h',
      HelmRepositoryURL: 'https://charts.example',
      TrustOnFirstConnect: false,
      EnforceEdgeID: false,
      AgentSecret: 'agent-secret',
      EdgePortainerUrl: 'https://portainer.example',
    });

    expect(vm.LogoURL).toBe('https://example.com/logo.png');
    expect(vm.BlackListedLabels).toEqual([{ name: 'com.docker.compose.project' }]);
    expect(vm.AuthenticationMethod).toBe(1);
    expect(vm.InternalAuthSettings).toEqual({ RequiredPasswordLength: 12 });
    expect(vm.LDAPSettings.URL).toBe('ldap://ldap.example');
    expect(vm.OAuthSettings).toBeInstanceOf(OAuthSettingsViewModel);
    expect(vm.OAuthSettings.ClientID).toBe('cid');
    expect(vm.OAuthSettings.SSO).toBe(true);
    expect(vm.SnapshotInterval).toBe('5m');
    expect(vm.TemplatesURL).toBe('https://templates.example/templates.json');
    expect(vm.UserSessionTimeout).toBe('8h');
    expect(vm.EnableEdgeComputeFeatures).toBe(false);
    expect(vm.AgentSecret).toBe('agent-secret');
  });
});

describe('REQ-SET-01 PublicSettingsViewModel mapping', () => {
  it('maps public auth, logo and nested Edge settings', () => {
    const vm = new PublicSettingsViewModel({
      AuthenticationMethod: 1,
      TeamSync: false,
      RequiredPasswordLength: 12,
      EnableEdgeComputeFeatures: true,
      EnforceEdgeID: true,
      LogoURL: '/logo.png',
      OAuthLoginURI: '/api/auth/oauth/login',
      OAuthLogoutURI: 'https://idp/logout',
      KubeconfigExpiry: '1h',
      Features: { something: true },
      Edge: {
        CheckinInterval: 5,
        PingInterval: 60,
        SnapshotInterval: 300,
        CommandInterval: 10,
      },
      DefaultRegistry: { HideDefaultRegistry: false },
      RequiresSetupToken: false,
    });

    expect(vm.AuthenticationMethod).toBe(1);
    expect(vm.RequiredPasswordLength).toBe(12);
    expect(vm.LogoURL).toBe('/logo.png');
    expect(vm.OAuthLoginURI).toBe('/api/auth/oauth/login');
    expect(vm.Edge).toBeInstanceOf(EdgeSettingsViewModel);
    expect(vm.Edge.CheckinInterval).toBe(5);
    expect(vm.Edge.PingInterval).toBe(60);
    expect(vm.DefaultRegistry).toEqual({ HideDefaultRegistry: false });
    expect(vm.RequiresSetupToken).toBe(false);
  });
});

describe('REQ-AUTH-07 InternalAuthSettingsViewModel', () => {
  it('maps the required password length', () => {
    const vm = new InternalAuthSettingsViewModel({ RequiredPasswordLength: 16 });
    expect(vm.RequiredPasswordLength).toBe(16);
  });
});

describe('REQ-AUTH-04 LDAPSettingsViewModel and search helpers', () => {
  it('maps LDAP connection and auto-create flags', () => {
    const vm = new LDAPSettingsViewModel({
      ReaderDN: 'cn=admin,dc=example,dc=com',
      Password: 'pw',
      URL: 'ldaps://ldap.example:636',
      SearchSettings: [{ BaseDN: 'ou=users' }],
      GroupSearchSettings: [{ GroupBaseDN: 'ou=groups' }],
      AutoCreateUsers: true,
    });
    expect(vm.ReaderDN).toBe('cn=admin,dc=example,dc=com');
    expect(vm.Password).toBe('pw');
    expect(vm.URL).toBe('ldaps://ldap.example:636');
    expect(vm.SearchSettings).toEqual([{ BaseDN: 'ou=users' }]);
    expect(vm.GroupSearchSettings).toEqual([{ GroupBaseDN: 'ou=groups' }]);
    expect(vm.AutoCreateUsers).toBe(true);
  });

  it('builds LDAPSearchSettings and LDAPGroupSearchSettings from constructor args', () => {
    const search = new LDAPSearchSettings('dc=example', 'uid', '(objectClass=person)');
    expect(search).toEqual({
      BaseDN: 'dc=example',
      UsernameAttribute: 'uid',
      Filter: '(objectClass=person)',
    });

    const group = new LDAPGroupSearchSettings('ou=groups', 'member', '(objectClass=group)');
    expect(group).toEqual({
      GroupBaseDN: 'ou=groups',
      GroupAttribute: 'member',
      GroupFilter: '(objectClass=group)',
    });
  });
});

describe('REQ-AUTH-06 OAuthSettingsViewModel', () => {
  it('maps OAuth client, endpoints and SSO fields', () => {
    const vm = new OAuthSettingsViewModel({
      ClientID: 'app',
      ClientSecret: 'sec',
      AccessTokenURI: 'https://idp/token',
      AuthorizationURI: 'https://idp/authorize',
      ResourceURI: 'https://idp/userinfo',
      RedirectURI: 'https://portainer/callback',
      UserIdentifier: 'sub',
      Scopes: 'openid profile',
      OAuthAutoCreateUsers: true,
      DefaultTeamID: 3,
      SSO: false,
      LogoutURI: 'https://idp/logout',
      AuthStyle: 1,
    });

    expect(vm.ClientID).toBe('app');
    expect(vm.AuthorizationURI).toBe('https://idp/authorize');
    expect(vm.OAuthAutoCreateUsers).toBe(true);
    expect(vm.DefaultTeamID).toBe(3);
    expect(vm.SSO).toBe(false);
    expect(vm.AuthStyle).toBe(1);
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
