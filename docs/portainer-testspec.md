# Portainer test spec

Test spec for `bespoke-portainer-ce`, phase B of the covered stage (COV-006 in [BESPOKE.md](../BESPOKE.md)). It maps every requirement in [portainer-spec.md](portainer-spec.md) (178 IDs `REQ-<AREA>-NN`, RAW-013) to the existing tests that check it. The test layers, commands and the reference test set are in [portainer-test-strategy.md](portainer-test-strategy.md).

Mapped on 2026-11-09 at `2-covered@af382f49d`, by reading test names, test files and, where a name was not clear, the test body. No test was run, added, renamed or changed for this mapping. The user's answers to the clarifications (COV-007, 2026-11-09) were applied to the statuses and notes below, and the deduced requirements REQ-DED-01 to REQ-DED-14 were added.

## Conventions

- Go paths are relative to the repo root. Frontend paths are relative to `app/` (for example `react/docker/images/ListView/PullImageFormWidget.test.tsx` is `app/react/docker/images/ListView/PullImageFormWidget.test.tsx`). A Go test is named `File: TestName`; a frontend test is named by file, and by `describe`/`it` text where the file covers more than one thing.
- Tests are mapped under their current upstream names. They are not renamed to carry requirement IDs, because this is a fork of an upstream project and renames would make every later upstream merge conflict. New tests written in phase C carry the ID in the name: Go `TestREQ_<AREA>_<NN>_<Behaviour>` (for example `TestREQ_CTR_10_LogsLineLimit`), Vitest `describe('REQ-CTR-10 …')`.
- Integration tests that skip without `INTEGRATION_TEST` (test strategy section 1) are marked *(gated)*; they are not part of the reference test set.
- Status per requirement:

| Status | Meaning |
|--------|---------|
| direct | At least one test asserts the behaviour the requirement states (not necessarily every sub-feature; gaps are in Notes). |
| partial | Tests assert some of the stated sub-features; named parts have no test. |
| loose | Tests only touch helpers, models or related code; nothing asserts the requirement itself. Counts as untested for coverage. |
| untested | No test found. |
| BE-absent | Marked **BE-only** in the spec and the CE tree has no implementation to test. Where a CE test asserts that the feature is hidden or shown as upsell, Notes say so. |
| not in repo | Not tested in this repo (C-08): the behaviour lives outside this repository (another project, a docs page, a helper image). |
| doc only | Documentation only, not a coverage target (C-06). |

## Summary

| Area | REQs | direct | partial | loose | untested | BE-absent | not in repo | doc only |
|------|-----:|-----:|-----:|-----:|-----:|-----:|-----:|-----:|
| SRV | 10 | 2 | 4 | 1 | 0 | 1 | 2 | 0 |
| AUTH | 14 | 2 | 5 | 1 | 2 | 3 | 1 | 0 |
| USR | 8 | 4 | 2 | 0 | 2 | 0 | 0 | 0 |
| ENV | 15 | 5 | 6 | 1 | 0 | 3 | 0 | 0 |
| POL | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| HOST | 5 | 1 | 3 | 0 | 1 | 0 | 0 | 0 |
| CTR | 16 | 6 | 5 | 1 | 3 | 1 | 0 | 0 |
| IMG | 8 | 4 | 1 | 1 | 1 | 1 | 0 | 0 |
| NET | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 0 |
| VOL | 5 | 0 | 0 | 1 | 4 | 0 | 0 | 0 |
| STK | 10 | 5 | 3 | 1 | 1 | 0 | 0 | 0 |
| SWM | 11 | 1 | 1 | 4 | 5 | 0 | 0 | 0 |
| TPL | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 0 |
| GIT | 3 | 2 | 0 | 0 | 1 | 0 | 0 | 0 |
| REG | 5 | 2 | 0 | 0 | 1 | 2 | 0 | 0 |
| K8S | 21 | 10 | 2 | 3 | 2 | 4 | 0 | 0 |
| ACI | 2 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| EDGE | 11 | 5 | 2 | 0 | 1 | 3 | 0 | 0 |
| SET | 8 | 1 | 2 | 1 | 1 | 3 | 0 | 0 |
| BKP | 3 | 2 | 0 | 0 | 0 | 1 | 0 | 0 |
| LOG | 5 | 1 | 0 | 1 | 0 | 3 | 0 | 0 |
| ALR | 2 | 0 | 0 | 0 | 0 | 2 | 0 | 0 |
| LIC | 3 | 0 | 1 | 0 | 1 | 1 | 0 | 0 |
| API | 4 | 1 | 0 | 0 | 0 | 0 | 2 | 1 |
| **Total (spec areas)** | **178** | **57** | **40** | **18** | **28** | **29** | **5** | **1** |
| DED | 14 | 1 | 3 | 3 | 7 | 0 | 0 | 0 |
| **Total with DED** | **192** | **58** | **43** | **21** | **35** | **29** | **5** | **1** |

"Has tests" means direct or partial. Loose, untested, BE-absent, not in repo and doc only are the untested side. Since COV-007: REQ-USR-05 moved from BE-absent to partial (built-in roles are CE, C-07); REQ-API-01 moved from untested to doc only (C-06); "external" is now "not in repo" (C-08). The REQs whose BE-only mark was lifted (STK-09, TPL-04, K8S-04, K8S-09, EDGE-02) keep their status, which already counted their CE tests. The DED row counts the deduced requirements (section DED below).

## Requirement mapping

### SRV – Server installation and runtime

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-SRV-01 | loose | `api/http/handler/file/handler_test.go`: `TestNormalServe`; `api/chisel/tunnel_test.go`: `TestGetUnusedPort` | Serving the UI assets is checked; the default ports 9443/9000/8000, the self-signed certificate and `--bind`/`--bind-https`/`--tunnel-*`/`--data`/`--assets` parsing are not. Running as a container is not testable in the unit suites (no end-to-end suite). | Also `api/cmd/portainer/local_docker_startup_test.go`: `TestREQ_SRV_01_*` (COV-044).
| REQ-SRV-02 | not in repo | none | Install targets are deployment docs and the separate Helm chart repository; nothing in this tree. |
| REQ-SRV-03 | not in repo | `api/agent/version_test.go`: `TestGetAgentVersionAndPlatform_*` (7); `api/docker/client/client_test.go`: `TestAgentClientHeaders_*`; `api/http/proxy/factory/agent/transport_test.go`: `TestTransport_roundTrip_*` | The Agent is a separate project. The server side of talking to an Agent (version probe, signed headers) is tested. |
| REQ-SRV-04 | partial | `api/cli/cli_test.go`: `TestOptionParser`, `TestParseEdgeFlags`, `TestValidateEdgePortainerURL`, `TestParseKubectlShellImageFlag`, `TestParseTLSFlags`; `api/cmd/portainer/main_test.go`: `Test_resolveSetupToken`, `TestUpdateSettingsFromFlags_KubectlShellImage`, `TestUpdateSettingsFromFlags_EdgeCompute`; `api/logs/log_test.go`: `TestSetLoggingLevel_*`, `TestSetLoggingMode_*`; `pkg/featureflags/featureflags_test.go`: `Test_enableFeaturesFromFlags`; `api/database/boltdb/db_test.go`: `TestDBCompaction` | No test for `--host`, `--admin-password`/`--admin-password-file`, `--hide-label`, `--logo`, `--templates`, `--snapshot-interval`, `--base-url`, `--http-disabled`/`--http-enabled`, `--rollback` parsing. | Also `api/cmd/portainer/local_docker_startup_test.go`: `TestREQ_SRV_04_*` (COV-044).
| REQ-SRV-05 | partial | `api/cli/cli_test.go`: `TestParseTLSFlags`; `api/crypto/tls_test.go`: `TestCreateTLSConfiguration*` (5); `api/http/middlewares/proxy_headers_test.go`: `TestIsHTTPSRequest` | Flag parsing and TLS config building are checked. HTTPS-only serving (`--http-disabled`), the deprecated `--ssl*` aliases and `GET/PUT /ssl` have no test. | Also `api/cmd/portainer/local_docker_startup_test.go`: `TestREQ_SRV_05_*` (COV-044).
| REQ-SRV-06 | BE-absent | none | |
| REQ-SRV-07 | direct | `api/cmd/portainer/main_test.go`: `TestLoadEncryptionSecretKey`, `TestDBSecretPath`; `api/database/boltdb/db_test.go`: `Test_NeedsEncryptionMigration`, `TestSetEncrypted_*`, `TestNeedsEncryptionMigration_InvalidKeyError`; `api/database/boltdb/json_test.go`: `Test_ObjectMarshallingEncrypted`, `TestDecrypt_*` | "Not reversible" is not asserted. | Also `api/database/boltdb/local_store_test.go`: `TestREQ_SRV_07_EncryptedStoreCRUD` (COV-046).
| REQ-SRV-08 | partial | `api/http/middlewares/proxy_headers_test.go`: `TestParseForwardedHeaderProto`, `TestIsHTTPSRequest`; `pkg/libhttp/clientip_test.go`: `TestClientIP`, `TestParseTrustedProxies_*`; `api/http/csrf/csrf_test.go`: `TestWithProtect_allowsPostFromTrustedOrigin`; `pkg/validate/validate_test.go`: `Test_IsTrustedOrigin` | Forwarded headers and trusted origins are checked; serving under `--base-url` has no test. |
| REQ-SRV-09 | partial | `api/datastore/migrate_data_test.go`: `TestMigrateData`, `TestRollback`; `api/datastore/migrator/*_test.go` (per-version migrations); `api/datastore/migrator/migrate_local_docker_test.go`: `TestMigrate_*` (COV-021); `api/datastore/migrator/migrate_local_docker_batch2_test.go`: `TestMigrate_*` (COV-022); `api/datastore/migrator/migrate_local_docker_batch3_test.go`: `TestMigrate_*` (COV-023; 2.43 helpers, migrate_ce, DB50, 2.44/2.45 local); `api/internal/upgrade/upgrade_docker_test.go`: `TestGetUpdaterImage`; `api/platform/platform_test.go`: `TestCheckDockerEnvTypeForUpgrade_*` | Database migration and `--rollback` are checked at store level; the platform-specific update procedure is docs (external). | Also `api/datastore/local_docker_store_test.go` local store wiring/export (COV-040).
| REQ-SRV-10 | direct | `api/http/csrf/csrf_test.go`: `TestWithProtect_*` (16); `api/http/security/bouncer_test.go`: `TestCSPHeaderDefault`, `TestCSPHeaderDisabled`; `api/http/handler/file/handler_test.go`: `TestPermissionsPolicyHeader` | "No behavioural analytics in CE" (absence) and the deprecated `--no-analytics` flag have no test. |

### AUTH – Setup, login and own account

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-AUTH-01 | direct | `api/http/handler/users/admin_init_test.go`: `Test_adminInit_setupTokenGate`; `api/http/security/setuptoken/setuptoken_test.go`: `Test_Generate`, `Test_Validate_*`; `api/cmd/portainer/main_test.go`: `Test_resolveSetupToken`; `api/adminmonitor/admin_monitor_test.go`: `Test_start_shouldDisableInstanceAfterTimeout_ifNotInitialized` and 4 lifecycle tests; `api/http/handler/file/handler_test.go`: `TestRedirectInstanceDisabled` | `GET /users/admin/check` and the `#!/init/admin` page have no test. The timeout length is a clarification (L-01). |
| REQ-AUTH-02 | partial | `react/portainer/environments/wizard/EnvironmentsCreationView/WizardDocker/APITab/DeploymentScripts.test.tsx`; `react/portainer/environments/wizard/EnvironmentsCreationView/WizardKubernetes/WizardKubernetes.test.tsx`; `portainer/views/auth/authController.test.js`: "does not follow a returnUrl over the wizard when an admin has no environments" | Two wizard tabs and the redirect into the wizard are checked; the local-socket and Edge tabs are not. |
| REQ-AUTH-03 | partial | `api/http/handler/auth/logout_test.go`: `TestLogout`, `TestLogoutNoPanic`, `TestLogout_ClearsCookie`; `api/http/security/bouncer_test.go`: `TestJWTRevocation`, `Test_extractKeyFromCookie`, `Test_extractBearerToken`, `Test_mwAuthenticateFirst*`; `api/jwt/*_test.go`; `api/logoutcontext/logoutcontext_test.go`; `api/http/security/passwordStrengthCheck_test.go`: `TestStrengthCheck`; `api/http/security/rate_limiter_test.go`: `TestLimitAccess*`; `portainer/authorization-guard.test.ts`; `portainer/views/auth/authController.test.js` | Logout, tokens and session handling are checked. The login handler itself (`POST /auth` with username/password against the internal store) has no test; phase C pins today's error responses (C-09, spec REQ-AUTH-03). | Also `app/portainer/services/authentication.test.js` session login/logout/init (COV-036).
| REQ-AUTH-04 | partial | `api/ldap/ldap_test.go`: `TestCreateConnectionForURL`, `TestFailures`; `react/portainer/settings/AuthenticationView/LDAPAuth/**` (6 files: `AdminGroupsSection`, `DnBuilder`, `DnEntriesField`, `GroupDnBuilder`, `ldap-dn-utils`, `LdapSecurityFieldset`, `LdapSettingsTestLogin`); `react/portainer/settings/AuthenticationView/AutoUserProvisionToggle/AutoUserProvisionToggle.test.tsx` | Settings form and connection building are checked; authenticating a user, automatic provisioning and team sync against a server, and `POST /ldap/check`, have no test. |
| REQ-AUTH-05 | BE-absent | `portainer/settings/authentication/ldap/ad-settings/ad-settings.controller.test.ts` (`parseDomainName`) | CE still ships an AD settings controller with a test; see clarification C-12. |
| REQ-AUTH-06 | partial | `api/oauth/oauth_test.go`: `Test_getOAuthToken`, `Test_getIdToken`, `Test_getResource*`, `Test_Authenticate`; `api/oauth/oauth_resource_test.go`: `Test_getUsername`; `api/http/handler/settings/settings_public_test.go`: `TestGeneratePublicSettingsWithSSO`, `TestGeneratePublicSettingsWithoutSSO`; `react/portainer/settings/AuthenticationView/AuthenticationMethodSelector.test.tsx` | `POST /auth/oauth/validate` (handler) and "only the custom provider is selectable in CE" have no test. |
| REQ-AUTH-07 | partial | `react/portainer/settings/AuthenticationView/SessionLifetimeSelect.test.tsx`; `api/jwt/jwt_test.go`: `TestExpiration` | The setting reaching the token lifetime through `PUT /settings` is not checked. Limits: L-02. |
| REQ-AUTH-08 | BE-absent | none | |
| REQ-AUTH-09 | untested | none | `PUT /users/{id}/passwd` (`userUpdatePassword`) has no test. |
| REQ-AUTH-10 | untested | none | |
| REQ-AUTH-11 | direct | `api/http/handler/users/user_create_access_token_test.go`: `Test_userCreateAccessToken`, `Test_userAccessTokenCreatePayload`; `user_get_access_tokens_test.go`: `Test_userGetAccessTokens`, `Test_hideAPIKeyFields`; `user_remove_access_token_test.go`: `Test_userRemoveAccessToken`; `api/apikey/*_test.go`; `react/portainer/account/CreateAccessTokenView/CreateUserAccessToken.test.tsx` | |
| REQ-AUTH-12 | BE-absent | none | |
| REQ-AUTH-13 | loose | `pkg/libhelm/validate_repo_test.go`: `Test_ValidateHelmRepositoryURL`, `TestValidateHelmRepositoryURL` | URL validation only; the `/users/{id}/helm/repositories` handlers have no test. |
| REQ-AUTH-14 | not in repo | none | The password-reset helper is a separate image. |

### USR – Users, teams and access control

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-USR-01 | partial | `api/http/handler/users/user_list_test.go`: `Test_userList`; `user_create_test.go`: `TestConcurrentUserCreation`; `user_delete_test.go`: `Test_deleteUserRemovesUserFromEndpointAccessPolicies`, `Test_deleteUserCleansUpK8sServiceAccount`, `Test_deleteUserRemovesAccessTokens`; `user_update_test.go`: `Test_updateUserRemovesAccessTokens` | List, create and delete are checked. `Test_updateUserRemovesAccessTokens` despite its name calls `deleteUser` (C-10: an update does not revoke tokens; the test is mapped as a delete test and not renamed); editing a user and `GET /users/me` have no test. |
| REQ-USR-02 | untested | none | |
| REQ-USR-03 | untested | none | |
| REQ-USR-04 | direct | `api/http/handler/teams/*_test.go`: `TestConcurrentTeamCreation`, `TestTeamDelete_*`, `Test_teamList`; `api/http/handler/teammemberships/*_test.go`: `TestDeleteTeamMembership_removesUserSABindings`, `TestTeamMembershipList_*`, `TestUpdate`; `api/dataservices/team/tests/team_test.go`: `Test_teamByName`; `api/http/security/filter_test.go`: `TestFilterUserTeams_*`, `TestLeaderTeamMembershipFilter_*`; `react/portainer/users/teams/**` (4 files, three of them only "renders correctly") | |
| REQ-USR-05 | partial | `pkg/authorization/resolver_test.go`: `TestFindRoleByID`, `TestGetHighestPriorityRole`, `TestResolveUserEndpointAccess_MultipleTeams_HighestPriorityWins`; `react/sidebar/SettingsSidebar.test.tsx`: "should not render Roles for team leader" | Built-in roles in access policies are a CE requirement (C-07); resolution by priority is checked, assigning a role in an access policy through the API/UI and `GET /roles` are not. The granular role editor stays BE (no test). |
| REQ-USR-06 | direct | `api/http/handler/users/user_effective_access_test.go`: `Test_userEffectiveAccess`; `react/portainer/users/RolesView/AccessViewer/EffectiveAccessViewer.test.tsx` | |
| REQ-USR-07 | direct | `pkg/authorization/resolver_test.go`: `TestResolveUserEndpointAccess_*` (9); `react/portainer/environments/environment-groups/ItemView/tabs/AccessTab.test.tsx`; `api/http/handler/docker/endpoint_authorization_test.go`, `api/http/handler/kubernetes/endpoint_authorization_test.go`: `TestEndpointAuthorization_*`; `api/http/handler/teams/team_delete_test.go`: `TestTeamDelete_removesTeamFromEndpoint*AccessPolicies` | The environment access page `#!/endpoints/{id}/access` has no UI test. |
| REQ-USR-08 | direct | `api/uac/*_test.go` (7 files: container, network, volume, config, secret getters, `TestCanBypassUAC`, `TestFilterByResourceControl`); `api/http/security/authorization_test.go`: `TestAuthorizedResourceControlUpdate_*` (12); `api/http/proxy/factory/docker/transport_test.go`: `TestTransport_proxyContainerRequest`, `TestTransport_proxyNetworkRequest`, `TestTransport_proxyExecRequest_accessControl`; `react/portainer/access-control/**` (`AccessControlForm`, its validation, `AccessControlPaneDetails`, `utils`)  `app/portainer/services/api/resourceControlService.test.js` (COV-027).| `POST/PUT/DELETE /resource_controls` handlers have no test. | Also `local_docker_proxy_test.go`: `TestREQ_USR_08_FindResourceControlDepth`, `TestREQ_USR_08_GetInheritedResourceControlFromServiceOrStack` (COV-031). Also `local_docker_proxy_cov032_test.go`: `TestREQ_USR_08_RestrictedResourceOperationLocal`, `TestREQ_USR_08_CreatePrivateResourceControlAndGenericCreation` (COV-032). Also `app/portainer/services/formValidator.test.js` (COV-036).

### ENV – Home and environments

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-ENV-01 | direct | `react/portainer/HomeView/EnvironmentList/EnvironmentList.test.tsx`; `…/EnvironmentItem/EnvironmentCard.test.tsx`, `EnvironmentGroupName.test.tsx`, `EnvironmentURL.test.tsx`; `react/portainer/HomeView/EnvironmentHeader/EnvironmentHeader.test.tsx`; `react/portainer/environments/queries/useParseApiSortParams.test.ts`; `api/http/handler/endpoints/endpoint_summary_counts_test.go`: `TestSummaryCounts*`, `TestResolveEndpointStatus`; `filter_test.go`, `filter_local_test.go`: `TestREQ_ENV_01_*` (COV-018); `endpoint_list_filter_test.go`: `TestREQ_ENV_01_List_*` / `Paginate*` (COV-019); `sort_test.go`, `endpoint_list_test.go`  `app/portainer/services/api/endpointService.test.js` (COV-025; local Docker EndpointService).| | Also `app/portainer/services/endpointProvider.test.ts`, `nameValidator.test.js` (COV-036).
| REQ-ENV-02 | partial | `api/http/handler/system/version_test.go`: `Test_getSystemVersion`; `react/sidebar/Footer/Footer.test.tsx` (`BuildInfoModalButton`, `UpdateNotification`)  `app/portainer/services/api/statusService.test.js` (COV-025).| `GET /system/info` and `GET /status` have no test. |
| REQ-ENV-03 | direct | `react/portainer/environments/ItemView/**` (`ItemView`, `EnvironmentDetailsForm`, `GeneralEnvironmentForm` and `helpers`, `EnvironmentFormActions`, `PublicUrlField`); `api/http/handler/endpoints/endpoint_update_test.go`: `TestReconcileK8sServiceAccounts`, `Test_endpointPut_TLSRejectedForEdgeEndpoint`; `endpoint_update_docker_test.go`: `TestREQ_ENV_03_UpdateDockerEndpoint_*` (COV-017); `endpoint_update_docker_extra_test.go`: `TestREQ_ENV_03_UpdateDockerEndpoint_*` / `ShouldReloadTLS*` (COV-018); `endpoint_update_tls_url_test.go`: TLS/URL/proxy/team (COV-019); `endpoint_inspect_test.go`: `TestREQ_ENV_03_Inspect*` (COV-017); `endpoint_delete_test.go`: `TestEndpointDelete*`; `endpoint_delete_batch_test.go`: `TestREQ_ENV_03_Delete*` (COV-017); `endpoint_delete_extra_test.go`: TLS/tags/relation/registry/deprecated batch (COV-019); `unique_name_test.go`: `TestREQ_ENV_03_IsNameUnique_*`, `HideFields_*` (COV-017); `utils_update_tags_test.go`: `Test_updateTags`; `utils_update_edge_groups_test.go`: `Test_updateEdgeGroups`  `app/portainer/services/api/accessService.test.js` (COV-027).| |
| REQ-ENV-04 | partial | `api/platform/platform_test.go`: `TestDetectLocalEnvironment_*`, `TestService_GetLocalEnvironment`; `api/internal/endpointutils/endpoint_setup_test.go`: `TestCreateOfflineUnsecuredEndpoint`; `react/portainer/environments/wizard/…/DeploymentScripts.test.tsx` (socket examples) | `--host` creating the local environment on first start is only checked for the unreachable case. |
| REQ-ENV-05 | partial | `api/http/proxy/factory/transport_test.go`: `TestNewDockerHTTPProxy_*`, `TestNewAgentProxy_*`; `api/http/handler/endpoints/endpoint_create_test.go`: `TestValidateEndpointCreatePayload_TLS`; `endpoint_agent_versions_test.go`: `Test_AgentVersions`; `api/internal/endpointutils/endpoint_test.go`: `Test_IsAgentEndpoint`, `Test_IsDockerEndpoint` | Proxy building and payload validation; the wizard's Agent/API forms have no test. |
| REQ-ENV-06 | loose | `pkg/snapshot/docker_test.go`: `TestCreateDockerSnapshot_SwarmNodeCount`; `api/platform/platform_test.go`: `TestCheckDockerEnvTypeForUpgrade_Swarm` | Adding a Swarm environment is not checked. |
| REQ-ENV-07 | partial | `api/platform/platform_test.go`: `TestDetermineContainerPlatform_Podman*`; `react/docker/containers/CreateView/NetworkTab/toViewModel.test.ts` (Podman defaults); `react/edge/components/EdgeScriptForm/scripts.test.ts`: "buildLinuxPodmanCommand should include PODMAN=1" | |
| REQ-ENV-08 | partial | `react/portainer/environments/wizard/EnvironmentsCreationView/WizardKubernetes/WizardKubernetes.test.tsx`; `api/internal/endpointutils/endpoint_test.go`: `Test_IsKubernetesEndpoint` | |
| REQ-ENV-09 | BE-absent | none | |
| REQ-ENV-10 | BE-absent | none | |
| REQ-ENV-11 | partial | `api/http/handler/endpoints/endpoint_create_test.go`: `TestSaveEndpointAndUpdateAuthorizations`, `TestCreateEndpointFailure`, `TestValidateEndpointCreatePayload_TLS`, `TestCreateEdgeAgentEndpoint_ContainerEngineMapping`; `endpoint_create_docker_test.go`: `TestREQ_ENV_11_*` (COV-018/019; unsecured/TLS Docker create, tags/gpus, TLS files); `endpoint_create_validate_extra_test.go`: `TestREQ_ENV_11_Validate_*` / `SaveEndpoint*WithTags` (COV-019) | Azure/Kubernetes create deferred-within-package. Agent create still thin. |
| REQ-ENV-12 | direct | `api/http/handler/endpoints/endpoint_snapshots_test.go`: `Test_endpointSnapshots`; `endpoint_snapshot_test.go`: `TestREQ_ENV_03_Snapshot*` (COV-017; single-endpoint snapshot + Edge rejection); `endpoint_create_snapshot_test.go`: `TestSnapshotAndPersistEndpoint_*`; `api/internal/snapshot/snapshot_test.go`: `TestSnapshotEndpointTx_*`; `pkg/snapshot/docker_test.go`, `pkg/snapshot/kubernetes_test.go`; `api/chisel/service_test.go`: `TestCheckTunnels*Snapshot*` | The periodic schedule from `--snapshot-interval`/settings is not checked. Limits: L-03. |
| REQ-ENV-13 | direct | `api/http/handler/endpointgroups/*_test.go`: `TestHandler_endpointGroupList`, `TestHandler_endpointGroupUpdate_UnassignedGroupName`; `react/portainer/environments/environment-groups/**` (7 files: create, edit, access tab, list table, associated environments, type breakdown, form)  `app/portainer/services/api/groupService.test.js` (COV-025). `app/portainer/services/api/groupService.test.js` membership helpers (COV-027).| `DELETE /endpoint_groups/{id}` has no test. | Also COV-041: `endpointgroup_create_test.go`, `endpointgroup_inspect_test.go`, `endpointgroup_delete_test.go`, `endpointgroup_endpoint_add_test.go`, `endpointgroup_endpoint_delete_test.go`, `endpointgroup_update_associations_test.go` (`TestREQ_ENV_13_*`).
| REQ-ENV-14 | direct | `api/http/handler/tags/tag_delete_test.go`: `TestHandler_tagDelete`, `TestTagDeleteEdgeGroupsConcurrently`; `api/tag/*_test.go`; `api/http/handler/endpoints/utils_update_tags_test.go`: `Test_updateTags`; `react/components/TagSelector/TagSelector.test.tsx`  `app/portainer/services/api/tagService.test.js` (COV-025).| `POST /tags` (create) has no handler test. |
| REQ-ENV-15 | BE-absent | none | |

### POL – Environment policies

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-POL-01 | BE-absent | none | |

### HOST – Docker dashboard, host and events

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-HOST-01 | partial | `api/http/handler/docker/endpoint_authorization_test.go`: `TestEndpointAuthorization_DeniedUser_Returns403`, `TestEndpointAuthorization_AuthorizedUser_NotForbidden` (on `GET /docker/1/dashboard`); `api/docker/stats/container_stats_test.go`: `TestCalculateContainerStats*`, `TestGetContainerStatus`; `react/components/DashboardItem/DashboardItem.test.tsx` | Access control and container state counts are checked; the tile counts per resource and the Docker dashboard page have no test. | Also `app/docker/helpers/infoHelper.test.js` (COV-037).
| REQ-HOST-02 | direct | `react/docker/host/HostDetailsPanel/HostDetailsPanel.test.tsx`; `react/docker/host/DockerStorageInfo.test.tsx` | PCI devices list has no test. |
| REQ-HOST-03 | partial | `api/http/handler/endpointproxy/proxy_agent_host_test.go`: `TestProxyAgentHostAPI_*` (6) | Error paths of the Agent host proxy; the browser UI has no test. |
| REQ-HOST-04 | partial | `api/http/proxy/factory/docker/containers_test.go`: `TestDecorateContainerCreationOperation_BindMount*`; `services_test.go`: `TestDecorateServiceCreationOperation_*`; `volumes_test.go`: `TestDecorateVolumeResourceCreationOperation_*`; `api/stacks/stackutils/validation_test.go`: `TestValidateStackFiles_*BlockedForNonAdmin`; `api/http/handler/endpoints/endpoint_settings_update_test.go`: `TestREQ_HOST_04_SettingsUpdate_*` (COV-017); `react/docker/containers/ItemView/ContainerActionsSection/SecondaryActions/useCanRecreateContainer.test.tsx`, `useCanDuplicateEditContainer.test.tsx`; `local_docker_proxy_test.go` / `local_docker_proxy_cov032_test.go`: `TestREQ_HOST_04_*` (update device-mapping COV-031; create privileged/pid/devices/sysctl/security-opt/capabilities/VolumesFrom COV-032) | Security restrictions covered; change window still untested. |
| REQ-HOST-05 | untested | none | |

### CTR – Docker containers

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-CTR-01 | partial | `react/docker/containers/utils.test.ts` (`toListViewModel`); `api/uac/containers_test.go`: `TestContainerResourceControlGetter`; `api/http/proxy/factory/docker/containers_test.go`: `TestREQ_CTR_01_*` (COV-030); `local_docker_proxy_test.go`: `TestREQ_CTR_01_ProxyContainerListWithLabelFiltering` (COV-031) | List view-model + proxy blacklist filtering via rewriteOperationWithLabelFiltering; datatable UI still untested. | Also `app/docker/helpers/containerHelper.test.js` (COV-037).
| REQ-CTR-02 | direct | `react/docker/containers/ItemView/ContainerActionsSection/ContainerActionsSection.test.tsx`; `api/http/proxy/factory/docker/local_docker_proxy_cov032_test.go`: `TestREQ_CTR_02_ProxyContainerUpdate` (COV-032) | Bulk actions from the list have no test. |
| REQ-CTR-03 | partial | prior create-form tests; `api/http/proxy/factory/docker/containers_test.go`: `TestDecorateContainerCreationOperation_*`; `local_docker_proxy_cov032_test.go`: `TestREQ_HOST_04_ContainerCreationSecurityRestrictions`, `TestREQ_CTR_03_ReferencedVolumeNames` (COV-032) | Proxy create security + volume name helpers; many create-form tabs still untested. | Also `app/docker/helpers/containerHelper.test.js`, `containers.test.ts`, `labelHelper.test.js` (COV-037).
| REQ-CTR-04 | partial | `react/docker/containers/ItemView/ItemView.test.tsx`, `ContainerDetailsSection/ContainerDetailsSection.test.tsx`, `ContainerStatusSection/ContainerStatusSection.test.tsx`, `VolumesSection/*.test.tsx`, `RestartPolicySection/RestartPolicySection.test.tsx`; `api/http/proxy/factory/docker/local_docker_proxy_test.go`: `TestREQ_CTR_04_ContainerInspectOperation`, `TestREQ_CTR_04_InheritedResourceControlFromContainerLabels`, `TestREQ_CTR_04_ProxyContainerInspect` (COV-031) | Proxy inspect + inherited stack/service labels; join/leave network form still untested. | Also `app/docker/models/containerDetails.test.ts`, `containerStats.test.ts` (COV-042).
| REQ-CTR-05 | untested | none | |
| REQ-CTR-06 | direct | `react/docker/containers/ItemView/ContainerActionsSection/SecondaryActions.test.tsx`, `SecondaryActions/useCanRecreateContainer.test.tsx`, `useCanDuplicateEditContainer.test.tsx` | The prefilled create form (`?from={id}`) has no test. | Also `app/docker/helpers/containerHelper.test.js` (COV-037).
| REQ-CTR-07 | direct | `react/docker/containers/ItemView/ContainerStatusSection/NameRow.test.tsx` | |
| REQ-CTR-08 | direct | `react/docker/containers/ItemView/CreateImageSection/CreateImageSection.test.tsx` | |
| REQ-CTR-09 | loose | `react/docker/containers/ItemView/VolumesSection/VolumeRow.test.tsx` | Shows mounts of an existing container; attaching a volume in the create form has no test. |
| REQ-CTR-10 | untested | none | Container log view (`app/docker/views/containers/logs`) has no test. Limits: L-10. |
| REQ-CTR-11 | direct | `react/docker/containers/StatsView/StatsView.test.tsx`; `react/docker/containers/queries/useContainerStats.test.ts`; `docker/models/containerStats.test.ts`; `react/components/Charts/StatsLineChart.test.tsx` | Process list has no test. | Also `app/docker/models/containerStats.test.ts` (COV-042).
| REQ-CTR-12 | partial | `api/http/handler/websocket/exec_test.go`: `TestWebsocketExec_deniesUnauthorizedEndpoint`; `attach_test.go`: `TestWebsocketAttach_deniesUnauthorizedEndpoint`; `initdial_test.go`: `TestInitDial`; `api/ws/*_test.go` (stream and resize helpers); `api/http/proxy/factory/docker/transport_test.go`: `TestTransport_proxyExecRequest_*`; `react/components/Terminal/Terminal.test.tsx` | Access denial and stream plumbing; a successful exec/attach session has no test. | Also COV-045: `attach_test.go`/`exec_test.go`/`handler_test.go`/`initdial_test.go` `TestREQ_CTR_12_*` and local Docker hijack/dial helpers.
| REQ-CTR-13 | partial | `react/portainer/access-control/**`; `api/http/proxy/factory/docker/transport_test.go`: `TestTransport_proxyContainerRequest` | Generic ownership tests; nothing on the container page itself. |
| REQ-CTR-14 | untested | none | Removing with anonymous volumes has no test. |
| REQ-CTR-15 | BE-absent | none | |
| REQ-CTR-16 | partial | `react/docker/containers/ItemView/ContainerDetailsSection/GpuRow.test.tsx` (`computeDockerGPUCommand`); `api/datastore/postinit/migrate_post_init_test.go`: `TestMigrateGPUs` | Display only; assignment in the create form and `GET …/containers/{id}/gpus` have no test. |

### IMG – Docker images

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-IMG-01 | direct | `react/docker/images/ListView/ImagesDatatable/ImagesDatatable.test.tsx`; `react/docker/images/ListView/ListView.test.tsx`; `react/docker/images/utils.test.ts` | `GET /docker/{id}/images` (handler) has no test. | Also `app/docker/models/image.test.ts` (COV-042).
| REQ-IMG-02 | direct | `react/docker/images/ListView/PullImageFormWidget.test.tsx`, `PullImageFormWidget.validation.test.tsx`; `react/components/ImageConfigFieldset/*.test.ts*`; `api/docker/images/image_test.go`: `TestImageParser` | | Also `app/docker/helpers/imageHelper.test.js` (COV-037). Also `app/docker/models/image.test.ts`, `porImageRegistry.test.js` (COV-042). Also `api/docker/images/image_hub_test.go`, `puller_test.go`, `ref_test.go`, `registry_test.go` (COV-043).
| REQ-IMG-03 | partial | `api/http/proxy/factory/docker/build_test.go`: `TestBuildOperationRemovesSpilledMultipartFilesOnSuccess`; `transport_test.go`: `TestTransport_proxyBuildRequest_Prune`; `local_docker_proxy_cov032_test.go`: `TestREQ_IMG_03_*` (buildOperation empty/json/multipart + interceptAndRewriteRequest via proxyBuild) (COV-032) | Local build rewrite covered; registry-auth image create/push deferred-within-package. Limits: L-11. | Also `app/docker/models/build.test.ts` (COV-042).
| REQ-IMG-04 | loose | `react/docker/images/ListView/ImagesDatatable/ImportExportButtons.test.tsx` ("should render Import button when user has DockerImageLoad authorization") | Button visibility only. |
| REQ-IMG-05 | direct | `react/docker/images/queries/useExportImageMutation.test.ts`; `ImportExportButtons.test.tsx` (export state) | |
| REQ-IMG-06 | untested | none | `api/docker/images/digest_test.go` parses image references, not the details page. | Also `app/docker/models/imageDetails.test.ts`, `imageLayer.test.ts` (COV-042). Also `api/docker/images/digest_local_test.go` `TestREQ_IMG_06_*` (COV-043).
| REQ-IMG-07 | direct | `react/docker/images/ListView/ImagesDatatable/ConfirmPruneModal.test.tsx`, `PruneButton.test.tsx`; `api/http/proxy/factory/docker/transport_test.go`: `TestTransport_proxyImageRequest_Prune` | Reclaimed-space report has no test. |
| REQ-IMG-08 | BE-absent | `api/docker/images/status_test.go`: `TestAggregateImageStatus`, `TestCachedResourceImageStatus*`, `TestCacheErrorImageStatus` | CE contains the image-status code with tests; see C-12. | Existing status tests remain BE-absent (C-12); no new CE tests in COV-043.

### NET – Docker networks

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-NET-01 | partial | `react/docker/networks/ListView/useNetworksData.test.ts`; `api/http/proxy/factory/docker/local_docker_proxy_test.go`: `TestREQ_NET_01_FindSystemNetworkResourceControl`, `TestREQ_NET_01_NetworkListDecoratesSystemNetworks` (COV-031) | System network RC + list decoration; Swarm grouping UI still thin. | Also `app/docker/models/network.test.ts` (COV-042).
| REQ-NET-02 | untested | none | | Also `app/docker/helpers/networkHelper.test.js` (COV-037).
| REQ-NET-03 | direct | `react/docker/networks/ItemView/NetworkDetailsTable.test.tsx`, `NetworkOptionsTable.test.tsx`, `NetworkContainersTable.test.tsx`; `api/http/proxy/factory/docker/local_docker_proxy_test.go`: `TestREQ_NET_03_InheritedResourceControlFromNetworkLabels` (COV-031) | Disconnecting a container has no test. | Also `app/docker/models/network.test.ts` (COV-042).
| REQ-NET-04 | loose | `react/docker/networks/ItemView/NetworkDetailsTable.test.tsx`: "Non system networks should have a delete button", "System networks shouldn't …" | Button presence only. |

### VOL – Docker volumes

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-VOL-01 | partial | `api/http/proxy/factory/docker/volumes_test.go`: `TestREQ_VOL_01_*` (COV-030); `access_control_test.go`: `TestREQ_VOL_01_GetStackResourceIDFromLabels` (COV-030); `local_docker_proxy_test.go`: `TestREQ_VOL_01_*` (getDockerID snapshot/remote/swarm, inherited volume labels, non-admin list filter) (COV-031) | Proxy list/decorate/filter/ResourceID; UI datatable still untested. | Also `app/docker/models/volume.test.ts` (COV-042).
| REQ-VOL-02 | partial | `api/http/proxy/factory/docker/volumes_test.go`: `TestDecorateVolumeResourceCreationOperation_*`, `TestREQ_VOL_02_*` (COV-030); `local_docker_proxy_cov032_test.go`: `TestREQ_VOL_02_VolumeCreateExistenceCheck` (COV-032) | Bind restrictions, create-response RC, existence-check conflict/create; create form untested. |
| REQ-VOL-03 | partial | `api/http/proxy/factory/docker/volumes_test.go`: `TestREQ_VOL_03_VolumeInspectOperation`, `TestREQ_VOL_03_VolumeInspectDeniedForNonAdminWithoutRC`, proxy inspect in `TestREQ_VOL_01_ProxyVolumeListAndInspect` (COV-030) | Proxy inspect + access denial; UI details page untested. | Also `app/docker/models/volume.test.ts` (COV-042).
| REQ-VOL-04 | partial | `api/http/proxy/factory/docker/local_docker_proxy_cov032_test.go`: `TestREQ_VOL_04_RestrictedResourceOperationVolumeBrowseAllowed` (COV-032) | Volume-browse AllowVolumeBrowser gate via restrictedResourceOperation; agent browse UI/API still thin. |
| REQ-VOL-05 | partial | `api/http/proxy/factory/docker/volumes_test.go`: `TestREQ_VOL_05_RestrictedVolumeOperationDeleteUnauthorized` (COV-030); `local_docker_proxy_test.go`: `TestREQ_VOL_05_ProxyVolumePruneAdminOnly` (COV-031); `local_docker_proxy_cov032_test.go`: `TestREQ_VOL_05_AdminDeleteVolumeRemovesResourceControl` (COV-032) | Non-owner delete denied; prune admin-only; admin delete removes RC. | Also `app/docker/helpers/volumeHelper.test.js` (COV-037).

### STK – Docker stacks

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-STK-01 | partial | `api/http/handler/stacks/stack_list_test.go`: `TestFilterStacks`; `api/http/handler/stacks/stack_list_http_test.go`: `TestREQ_STK_01_List*` (COV-011); `api/http/handler/stacks/stack_inspect_test.go`: `TestREQ_STK_01_Inspect*` (COV-010); `api/http/handler/stacks/handler_authz_test.go`: `TestREQ_STK_01_Inspect_OrphanEndpointMissing_AdminOK` (COV-013); `api/http/handler/docker/utils/get_stacks_test.go`: `TestHandler_getDockerStacks`; `react/docker/stacks/ItemView/StackInfoTab/StackInfoTab.test.tsx` ("external and orphaned warnings")  `app/portainer/services/api/stackService.test.js` (COV-025; compose client).| The stacks datatable and its control column have no test. |
| REQ-STK-02 | direct | `react/docker/stacks/CreateView/CreateStackForm/**` (`CreateStackForm`, `validation`, `EditorSection` and its validation, `UploadSection` and its validation); `react/docker/stacks/common/*.test.ts`; `api/stacks/stackutils/validation_test.go`, `env_test.go`; `api/exec/compose_stack_test.go`: `Test_createEnvFile*`; `api/stacks/stackbuilders/director_test.go`; `pkg/libstack/compose/composeplugin_test.go`: `Test_Validate`, `Test_Config`, `Test_MaxConcurrency`; `Test_UpAndDown*` *(gated)*; `api/http/handler/stacks/stack_create_test.go`: `TestREQ_STK_02_*` (COV-011); `api/http/handler/stacks/create_compose_git_test.go`, `create_compose_file_upload_test.go`, `handler_authz_test.go`: `TestREQ_STK_02_*` (COV-013)  `app/portainer/services/api/stackService.test.js` compose create/lifecycle (COV-027).| | Also `api/filesystem/local_docker_store_test.go`: `TestREQ_STK_02_*` (COV-034). Also `app/portainer/services/fileUpload.test.js` createComposeStack; `fileUploadReact.test.ts` (COV-036). Also `api/stacks/deployments/compose_unpacker_cmd_builder_test.go`, `deployment_compose_config_test.go`, `deployer_compose_test.go` (COV-039).
| REQ-STK-03 | direct | `react/docker/stacks/CreateView/CreateStackForm/GitSection/*.test.ts*`; `api/http/handler/stacks/create_compose_stack_test.go`, `create_swarm_stack_test.go` (`…GitPayload_Validate*`); `api/stacks/stackbuilders/stack_git_builder_test.go`; `api/stacks/deployments/deploy_test.go`: `Test_redeployWhenChanged_*`; `api/git/update/validate_test.go`: `Test_ValidateAutoUpdate`; `api/http/handler/stacks/webhook_invoke_test.go`: `TestHandler_webhookInvoke`; `api/git/*_test.go` (clone, refs, files; GitHub/Azure *(gated)*); `api/http/handler/stacks/stack_update_git_extra_test.go`: `TestREQ_STK_03_*` (COV-011); `api/http/handler/stacks/stack_update_git_compose_test.go`: `TestREQ_STK_03_Redeploy*` (COV-013) | Relative path volumes are BE. | Also `api/filesystem/local_docker_store_test.go`: `TestREQ_STK_03_*` (COV-034). Also `api/stacks/deployments/deploy_local_extra_test.go`: `TestREQ_STK_03_*` (COV-039).
| REQ-STK-04 | direct | `react/docker/stacks/ItemView/StackEditorTab/*.test.tsx`; `react/common/stacks/EditGitSettings/EditGitSettingsModal.test.tsx`; `api/http/handler/stacks/stack_update_test.go`, `stack_file_test.go`, `stack_update_git_redeploy_test.go`, `stack_update_git_test.go`; `stack_update_git_compose_test.go`, `stack_update_compose_extra_test.go` (COV-013); `stack_update_compose_gitdetach_test.go`, `stack_deploy_async_test.go`, `stack_file_compose_extra_test.go`, `stack_update_git_compose_extra2_test.go`, `stack_update_swarm_http_test.go`: `TestREQ_STK_04_*` (COV-014) | | Also `api/filesystem/local_docker_store_test.go`: `TestREQ_STK_04_*` (COV-034).
| REQ-STK-05 | partial | `api/http/handler/stacks/stack_start_test.go`: `TestStackStart_*` (6); `api/http/handler/stacks/stack_stop_test.go`: `TestREQ_STK_05_*` (7, COV-010); `api/http/handler/stacks/handler_authz_test.go`: `TestREQ_STK_05_StartMissing*` (COV-013); `stack_start_compose_extra_test.go`, `stack_stop_compose_extra_test.go`: `TestREQ_STK_05_*` (COV-014) | Compose stop/start edges expanded; Swarm stop path and remote relative-path stop still thin. | Also `api/stacks/deployments/compose_unpacker_cmd_builder_test.go`: `TestREQ_STK_05_*` (COV-039).
| REQ-STK-06 | untested | none | |
| REQ-STK-07 | direct | `react/docker/stacks/ItemView/StackInfoTab/StackDuplicationForm/**`; `api/http/handler/stacks/stack_migrate_test.go`: `TestREQ_STK_07_*` (COV-011); `stack_migrate_compose_extra_test.go`, `stack_migrate_swarm_test.go`: `TestREQ_STK_07_*` (COV-014) | Compose migrate edges and swarm migrate success covered. |
| REQ-STK-08 | direct | `api/http/handler/stacks/stack_delete_test.go`: `TestStackDelete_*`, `TestDeleteExternalStack_*`, `TestStackDeleteKubernetesByName_*`; `stack_delete_compose_extra_test.go`: `TestREQ_STK_08_*` (COV-014); `api/stacks/teardown/teardown_test.go` | | Also `api/stacks/deployments/compose_unpacker_cmd_builder_test.go`, `deployer_compose_test.go`, `deployment_compose_config_test.go` undeploy (COV-039).
| REQ-STK-09 | loose | `api/http/handler/stacks/webhook_invoke_test.go`: `TestHandler_webhookInvoke`; `react/docker/stacks/CreateView/CreateStackForm/CreateStackForm.webhook.test.tsx`; `react/docker/stacks/ItemView/StackEditorTab/StackEditorTab.webhook.test.tsx`; `api/http/handler/stacks/create_compose_git_test.go`: `TestREQ_STK_09_CreateComposeFromGit_DuplicateWebhook_ReturnsConflict`; `stack_update_git_compose_test.go`: `TestREQ_STK_04_UpdateGit_DuplicateWebhook_ReturnsConflict` / `…WithAutoUpdateWebhook_Unique_OK` (COV-013) | CE requirement since C-01 (the spec was too narrow). The invoke handler and the form wiring are touched; nothing asserts the redeploy itself. Pull prevention and env vars stay BE-only (not tested). |
| REQ-STK-10 | partial | `react/docker/stacks/ItemView/StackInfoTab/AssociateStackForm.test.tsx`, `useAssociateStackToEnvironmentMutation.test.tsx`; `api/http/handler/stacks/stack_associate_test.go`: `TestREQ_STK_10_*` (4, COV-010) | Handler associate for compose stacks covered; swarmId edge cases still thin. |

### SWM – Docker Swarm

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-SWM-01 | loose | `pkg/snapshot/docker_test.go`: `TestCreateDockerSnapshot_SwarmNodeCount`, `TestDockerSnapshotNodes_CountAndResources` | Node counts in snapshots; the cluster and node pages have no test. |
| REQ-SWM-02 | untested | none | |
| REQ-SWM-03 | partial | `react/docker/services/ItemView/PortMappingField/toRequest.test.ts`, `toViewModel.test.ts`; `api/http/proxy/factory/docker/services_test.go`: `TestDecorateServiceCreationOperation_*` (21), `TestCheckServiceBodyRestrictions_BindVolumeOnOtherClusterNode`; `pkg/libstack/swarm/swarm_unit_test.go` | Port mapping and security checks; the create form has no test. |
| REQ-SWM-04 | loose | `api/http/proxy/factory/docker/services_test.go`: `TestDecorateServiceUpdateOperation_VolumeWithBindDriverOptionForbidden` | |
| REQ-SWM-05 | untested | none | |
| REQ-SWM-06 | untested | none | |
| REQ-SWM-07 | untested | none | |
| REQ-SWM-08 | loose | `pkg/libstack/swarm/swarm_unit_test.go`: `Test_deployServices_forceRecreate` | Stack-level force recreate; `PUT /endpoints/{id}/forceupdateservice` and rollback have no test. |
| REQ-SWM-09 | untested | none | `/webhooks` handlers have no test. |
| REQ-SWM-10 | direct | `react/docker/configs/ListView/ConfigsDatatable/ConfigsDatatable.test.tsx`, `DeleteConfigButton.test.tsx`; `react/docker/configs/ListView/ListView.test.tsx`; `api/uac/configs_test.go` | Adding a config has no test. |
| REQ-SWM-11 | loose | `api/uac/secrets_test.go`: `TestSecretResourceControlGetter` | |

### TPL – Templates

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-TPL-01 | partial | `react/portainer/templates/app-templates/AppTemplatesListItem.test.tsx`; `…/DeployFormWidget/EnvVarsFieldset.test.tsx`  `app/portainer/services/api/templateService.test.js` (COV-028).| `GET /templates`, `POST /templates/{id}/file` and deploying as container or stack have no test. |
| REQ-TPL-02 | untested | none | The templates URL appears only in store/marshal fixtures. |
| REQ-TPL-03 | direct | `api/http/handler/customtemplates/*_test.go` (create from content/upload/repository, update, delete, file, inspect, list, git fetch; about 70 tests); `api/dataservices/customtemplate/*_test.go`; `react/components/CustomTemplateSelector.test.tsx`; `react/docker/stacks/CreateView/CreateStackForm/TemplateSection/*.test.ts*`; `react/portainer/templates/custom-templates/ListView/StackFromCustomTemplateFormWidget/useIsDeployable.test.tsx`  `app/portainer/services/api/customTemplate.test.js` (COV-027).| | Also `api/filesystem/local_docker_store_test.go`: `TestREQ_TPL_03_StoreCustomTemplateFile` (COV-034). Also `app/portainer/services/fileUpload.test.js` createCustomTemplate (COV-036).
| REQ-TPL-04 | loose | `api/http/handler/customtemplates/customtemplate_create_test.go`: `…_Variables`, `…_InvalidVariables`; `react/portainer/custom-templates/components/CustomTemplatesVariablesField/*.test.tsx`; `TemplateSection/useTemplateInitialization.test.ts` | CE requirement since C-02. Validation and the form fields are tested; filling variables at deploy time is not asserted end to end. |

### GIT – App Delivery

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-GIT-01 | direct | `api/gitops/workflows/*_test.go` (fetch, filter, mapping, status, delete, source artifacts); `api/http/handler/gitops/workflows/*_test.go` (list, get, fetch, filter, status, summary); `react/portainer/gitops/workflows/ItemView/ItemView.test.tsx`, `status.test.ts`; `react/portainer/gitops/GitReferenceCard.test.tsx` | |
| REQ-GIT-02 | direct | `api/http/handler/gitops/sources/*_test.go` (create, update, delete, get, list, summary, source workflows, mapping); `api/dataservices/source/*_test.go`; `api/gitops/sources/*_test.go`; `api/gitops/scheduling/scheduler_test.go`; `react/portainer/gitops/sources/**` (10 files) | `PUT /gitops/sources/{id}/access` has no handler test. |
| REQ-GIT-03 | untested | none | `POST /gitops/repo/file/preview` has no test. |

### REG – Registries

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-REG-01 | direct | `api/http/handler/registries/*_test.go` (create, update, delete, configure, ping); `pkg/registryhttp/client_test.go`; `pkg/liboras/registry_test.go`; `api/aws/ecr/parse_endpoints_test.go`; `api/internal/registryutils/*_test.go`; `react/portainer/registries/CreateView/RegistryFormDockerhub/RegistryFormDockerhub.test.tsx`, `TestConnection/RegistryTestConnection.test.tsx` | Only the Docker Hub form has a UI test. |
| REQ-REG-02 | BE-absent | none | |
| REQ-REG-03 | direct | `api/http/handler/registries/registry_access_test.go`: `Test_RegistryAccess_*`; `api/http/handler/endpoints/endpoint_registry_access_test.go`: `TestApplyKubeRegistryAccess_*`; `react/portainer/registries/environments/ListView/EnvironmentRegistriesDatatable/EnvironmentRegistriesDatatable.test.tsx`; `react/kubernetes/cluster/RegistryAccessView/AccessTable.test.tsx`; `react/kubernetes/components/K8sRegistryAccessNotice.test.tsx` | |
| REQ-REG-04 | BE-absent | `react/portainer/registries/repositories/ItemView/TagsDatatable/TagsDatatable.test.tsx`; `pkg/liboras/dummy_manifest_test.go`: `TestSafeDeleteTags` | CE has a tags table and tag deletion helper with tests; see C-12. |
| REQ-REG-05 | partial | `api/http/handler/endpoints/endpoint_dockerhub_status_test.go`: `TestREQ_REG_05_*` (COV-018; pull-limit-disabled path, local/non-local guards, parseRateLimitHeader) | Live Docker Hub token/limits HTTP still untested. |

### K8S – Kubernetes

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-K8S-01 | untested | none | |
| REQ-K8S-02 | direct | `api/http/handler/websocket/shell_pod_test.go`: `TestWebsocketShellPodExec_*`, `TestSetPodExecTarget_overridesCallerSuppliedParams`; `react/kubernetes/cluster/KubectlShell/KubectlShellView.test.tsx`; `react/sidebar/KubernetesSidebar/KubectlShellButton.test.tsx` | |
| REQ-K8S-03 | direct | `api/http/handler/kubernetes/config_test.go`: `TestBuildConfig_IssuesACredentialPerEnvironment`; `api/jwt/jwt_kubeconfig_test.go`; `api/kubernetes/kubeclusteraccess_service_test.go`; `react/portainer/HomeView/EnvironmentList/KubeconfigButton/KubeconfigPrompt.test.tsx`; `react/portainer/environments/ItemView/KubeConfigInfo/KubeConfigInfo.test.tsx` | |
| REQ-K8S-04 | loose | `api/http/handler/customtemplates/customtemplate_create_test.go`: `…KubernetesTypeIgnoresPlatform`, `…KubernetesIgnoresPlatform` | The Kubernetes custom templates pages have no test. Variables are CE (C-02). |
| REQ-K8S-05 | direct | `api/http/handler/kubernetes/namespaces_test.go`; `api/http/proxy/factory/kubernetes/namespaces_test.go`: `TestProxyNamespaceDeleteOperation_*`; `api/kubernetes/cli/namespace_test.go`, `access_test.go`, `resource_quota_test.go`; `api/kubernetes/namespacecleanup/namespacecleanup_test.go`; `react/kubernetes/namespaces/ItemView/*.test.ts*` (4) | Creating a namespace has no test. |
| REQ-K8S-06 | loose | `react/kubernetes/applications/components/NamespaceSelector/NamespaceSelector.test.tsx`; `react/kubernetes/applications/components/ApplicationSummarySection/utils.test.ts` | The application form as a whole has no test. |
| REQ-K8S-07 | direct | `api/http/handler/kubernetes/manifest_dry_run_test.go`; `pkg/libkubectl/apply_dry_run_test.go`, `apply_dynamic_test.go`; `api/exec/kubernetes_deploy_test.go`: `TestExecuteKubectlOperation_*`; `api/http/handler/stacks/create_kubernetes_stack_test.go`; `api/kubernetes/yaml_test.go` | Deploy from URL has no test. |
| REQ-K8S-08 | direct | `api/http/handler/helm/*_test.go` (7); `pkg/libhelm/**` (`sdk` install, upgrade, rollback, uninstall, history, show, search; some *(gated)*); `react/kubernetes/helm/**` (14 files) | |
| REQ-K8S-09 | direct | `react/kubernetes/applications/DetailsView/**`, `ListView/**`, `StatsView/**`, `utils.test.ts`, `queries/useAppStackFile.test.tsx`; `api/kubernetes/cli/applications_test.go`, `pod_test.go`, `deployment_test.go`, `deployment_rollback_test.go`; `api/http/handler/kubernetes/pod_test.go`, `deployment_test.go`, `workload_write_test.go`; `api/http/handler/websocket/pod_test.go` | Scale, patch, rollback and pod restart are CE requirements (C-03); their handlers have tests. |
| REQ-K8S-10 | BE-absent | none | |
| REQ-K8S-11 | loose | `api/http/handler/kubernetes/workload_write_test.go`: `TestDeleteKubernetesDeployment`; `api/http/handler/stacks/stack_delete_test.go`: `TestStackDeleteKubernetesByName_*` | Removing an application from the UI and detaching a volume have no test. |
| REQ-K8S-12 | direct | `api/kubernetes/cli/ingress_test.go`, `service_test.go`; `api/http/handler/kubernetes/ingress_class_test.go`; `react/kubernetes/services/ServicesView/ServicesDatatable/ServicesDatatable.test.tsx` | Adding/removing ingresses through the UI has no test. |
| REQ-K8S-13 | direct | `api/kubernetes/cli/configmap_test.go`, `secret_test.go`, `secret_write_test.go`; `api/http/handler/kubernetes/configuration_write_test.go`; `react/kubernetes/configs/**` (4) | |
| REQ-K8S-14 | direct | `api/kubernetes/cli/persistent_volume_claims_test.go`, `persistent_volumes_test.go`, `storage_classes_test.go`, `volumes_test.go`; `react/kubernetes/volumes/ListView/*.test.tsx` (5) | |
| REQ-K8S-15 | BE-absent | `pkg/snapshot/kubernetes_test.go`: `TestKubernetesSnapshotNodes*GPU*` | GPU counting in snapshots exists in CE. |
| REQ-K8S-16 | partial | `api/kubernetes/cli/cronjob_test.go`, `job_test.go`, `service_account_test.go`; `api/http/handler/kubernetes/service_accounts_test.go`; `react/kubernetes/more-resources/**` (5) | Cluster roles/bindings and roles/bindings have no test. |
| REQ-K8S-17 | direct | `api/kubernetes/cli/nodes_test.go`, `nodes_limits_test.go`; `api/http/handler/kubernetes/node_test.go`, `drain_node_payload_test.go`; `pkg/libkubectl/drain_test.go`, `agent_failover_test.go`; `react/kubernetes/cluster/**` (10) | |
| REQ-K8S-18 | untested | none | `api/kubernetes/cli/metrics_test.go` (`TestFeatureGateEnabled`) is not the setup page. |
| REQ-K8S-19 | BE-absent | none | |
| REQ-K8S-20 | partial | `api/cli/cli_test.go`: `TestParseKubectlShellImageFlag`; `api/cmd/portainer/main_test.go`: `TestUpdateSettingsFromFlags_KubectlShellImage`; `pkg/libhelm/validate_repo_test.go` | Kubeconfig expiry and deployment options have no test. Limits: L-04. |
| REQ-K8S-21 | BE-absent | none | |

### ACI – Azure Container Instances

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-ACI-01 | partial | `react/portainer/environments/ItemView/AzureEnvironmentForm/AzureEnvironmentForm.test.tsx`, `AzureEndpointConfigSection/AzureEndpointConfigSection.test.tsx` | Editing only; creating the environment has no test. |
| REQ-ACI-02 | direct | `react/azure/DashboardView/DashboardView.test.tsx`; `react/azure/container-instances/CreateView/CreateContainerInstanceForm.test.tsx`; `react/azure/services/container-groups.service.test.ts`; `react/sidebar/AzureSidebar/AzureSidebar.test.tsx`; `api/internal/snapshot/snapshot_test.go`: `TestSnapshotEndpointTx_AzureEnvironment_NoOp` | View and remove have no test. |

### EDGE – Edge Compute

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-EDGE-01 | direct | `api/cli/cli_test.go`: `TestParseEdgeFlags`, `TestValidateEdgePortainerURL`, `TestOptionParser`; `api/cmd/portainer/main_test.go`: `TestUpdateSettingsFromFlags_EdgeCompute`; `react/portainer/init/InitEdgeView/InitEdgeView.test.tsx` | The `#!/settings/edge` page has no test. |
| REQ-EDGE-02 | direct | `api/http/handler/endpointedge/*_test.go`; `api/chisel/service_test.go`; `api/http/handler/endpoints/endpoint_create_global_key_test.go`: `TestEmptyGlobalKey`; `pkg/edge/utils_test.go`; `pkg/endpoints/utils_test.go`; `react/portainer/environments/ItemView/EdgeEnvironmentForm/*`, `EdgeInformationPanel/*`, `EdgeAgentDeploymentWidget/*`; `react/portainer/environments/common/EdgeIntervalsFieldset/*` | Async mode is a CE requirement (C-04) and its UI fields and scripts are tested. |
| REQ-EDGE-03 | partial | `react/edge/components/EdgeScriptForm/scripts.test.ts` (+ snapshot) | Script generation; the `#!/endpoints/aeec` page has no test. |
| REQ-EDGE-04 | untested | none | |
| REQ-EDGE-05 | direct | `api/http/handler/edgegroups/*_test.go` (5); `api/dataservices/endpointrelation/*_test.go`; `api/internal/edge/endpoint_test.go`; `api/datastore/migrator/migrate_2_33_test.go`; `api/http/handler/endpoints/filter_test.go`: `TestFilterEndpointsByEdgeGroup` | No UI test. |
| REQ-EDGE-06 | direct | `api/http/handler/edgestacks/*_test.go` (create, delete, inspect, status update, update); `api/internal/edge/edgestacks/*_test.go`; `api/dataservices/edgestack/*_test.go`; `react/edge/edge-stacks/**` (7) | |
| REQ-EDGE-07 | direct | `api/http/handler/edgejobs/*_test.go`; `api/http/handler/endpointedge/endpointedge_job_logs_test.go`; `endpointedge_status_inspect_test.go`: `TestEdgeJobsResponse` | No UI test. |
| REQ-EDGE-08 | partial | `react/edge/edge-stacks/CreateView/tests/app-templates.test.tsx`, `custom-templates.test.tsx`; `CreateView/TemplateFieldset/*.test.tsx`; `api/http/handler/customtemplates/customtemplate_create_test.go`: `TestCustomTemplateCreate_FromFileContent_EdgeTemplate` | Using templates in an Edge stack; the Edge templates pages have no test. |
| REQ-EDGE-09 | BE-absent | none | |
| REQ-EDGE-10 | BE-absent | `api/cli/cli_test.go`: `TestParseEdgeFlags` (`--edge-trust-on-first-connect`) | |
| REQ-EDGE-11 | BE-absent | `react/portainer/HomeView/EnvironmentList/EnvironmentItem/EnvironmentCard.test.tsx` ("Browse snapshot button", partly a TODO) | |

### SET – Global settings

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-SET-01 | partial | `api/http/handler/settings/settings_public_test.go`; `api/datastore/datastore_test.go`: `TestStoreFull/Settings`; `api/datastore/migrate_dbversion29_test.go`: `TestMigrateSettings`; `api/cmd/portainer/main_test.go`: `TestUpdateSettingsFromFlags_*`; `react/sidebar/Header.test.tsx` (custom logo); `react/portainer/settings/SettingsView/SettingsView.test.tsx`  `app/portainer/services/api/settingsService.test.js` (COV-025).| `PUT /settings` (handler validation) has no test. Limits: L-03, L-05. | Also `app/portainer/services/localStorage.test.js`, `pagination.test.js`, `themeManager.test.js`, `stateManager.test.js` (COV-036). Also `api/datastore/local_docker_store_test.go`: `TestREQ_SET_01_*` (COV-040).
| REQ-SET-02 | untested | none | Hidden labels appear only in marshal fixtures. |
| REQ-SET-03 | direct | `pkg/libhttp/ssrf/ssrf_test.go` (17); `api/git/protocols_test.go`: `TestInstallSSRFProtocols`; `api/stacks/stackutils/validation_test.go`: `TestValidateComposeURLs_*`; `pkg/libhelm/sdk/ssrf_policy_test.go` | The settings UI has no test. The default `SSRFModeOff` (C-05) has no test asserting it. |
| REQ-SET-04 | loose | `api/datastore/datastore_test.go`: `TestStoreFull/SSL Settings`; `api/cli/cli_test.go`: `TestParseTLSFlags` | `GET/PUT /ssl` and `POST /upload/tls/{certificate}` have no test. | Also `api/filesystem/local_docker_store_test.go`: `TestREQ_SET_04_*` TLS/SSL store (COV-034). Also `app/portainer/services/fileUpload.test.js`: TLS upload for endpoint (COV-036).
| REQ-SET-05 | BE-absent | `react/portainer/settings/SettingsView/SettingsView.test.tsx`: "should NOT render ExperimentalFeatures component in CE edition" | Checks CE absence. |
| REQ-SET-06 | BE-absent | `react/sidebar/SettingsSidebar.test.tsx`: "should not render Shared Credentials in CE" | Checks CE absence. |
| REQ-SET-07 | BE-absent | none | |
| REQ-SET-08 | partial | `api/motd/service_test.go` (5) | Service cache; `GET /motd` and the home-screen banner have no test. |

### BKP – Backup and restore

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-BKP-01 | direct | `api/http/handler/backup/backup_test.go`; `api/backup/backup_test.go`: `TestCreateBackupArchive_*`, `TestEncryptDecrypt_*`, `Test_backupDb_timesOutWhenBackupToHangs`; `api/datastore/backup_test.go`; `api/archive/*_test.go` | The settings page has no test. Limits: L-07. | Also `api/database/boltdb/local_store_test.go`: `TestREQ_BKP_01_BackupToWriter` (COV-046).
| REQ-BKP-02 | direct | `api/http/handler/backup/restore_test.go`: `Test_restoreArchive_*`, `Test_restore_setupTokenGate`; `api/backup/backup_test.go`: `TestRestoreArchive_*`, `TestGetRestoreSourcePath_*`; `api/archive/targz_test.go`: `TestExtractTarGzPathTraversal`; `api/http/offlinegate/offlinegate_test.go` | The restore option on `#!/init/admin` has no test. Limits: L-06, L-08. |
| REQ-BKP-03 | BE-absent | `react/portainer/HomeView/BackupFailedPanel.test.tsx` | CE shows a "backup failed" panel with a test (its second test name is copied from the license test); see C-12. |

### LOG – Logs and notifications

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-LOG-01 | BE-absent | `react/sidebar/SettingsSidebar.test.tsx`: "should render logs submenu items" | Sidebar entries only. |
| REQ-LOG-02 | BE-absent | same as LOG-01 | |
| REQ-LOG-03 | BE-absent | none | |
| REQ-LOG-04 | loose | `portainer/services/notifications.test.ts`; `react/sidebar/SettingsSidebar.test.tsx`: "should render notifications …" | Toast helpers and the sidebar link; the history page, search/remove and the 50-item bell limit (`NotificationsMenu.tsx`) have no test. Limits: L-09, REQ-DED-10; history unbounded (C-11). | Existing `notifications.test.ts` kept in package measurement (COV-036).
| REQ-LOG-05 | direct | `api/logs/log_test.go`: `TestSetLoggingLevel_*`, `TestSetLoggingMode_*` | Flag-to-logger wiring in `main` is not checked. |

### ALR – Alerting and recommendations

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-ALR-01 | BE-absent | `pkg/libprometheus/*_test.go` (config, rules, scrape) | CE ships a Prometheus/Alertmanager library with tests; see C-12. |
| REQ-ALR-02 | BE-absent | none | |

### LIC – Licensing and Business Edition

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-LIC-01 | BE-absent | `react/portainer/licenses/license.service.test.ts`; `react/portainer/HomeView/LicenseNodePanel.test.tsx`; `react/sidebar/SettingsSidebar.test.tsx`: "should not render Licenses sidebar item in CE" | CE has the license client and a node-limit panel with tests. |
| REQ-LIC-02 | untested | none | `app/react/sidebar/UpgradeBEBanner` and `POST /system/upgrade` have no test. |
| REQ-LIC-03 | partial | `react/sidebar/Footer/Footer.test.tsx` (CE vs BE footer); `api/http/handler/system/version_test.go`: `Test_getSystemVersion/Display Edition`; `react/portainer/settings/SettingsView/SettingsView.test.tsx`; `react/sidebar/SettingsSidebar.test.tsx` (CE hides Licenses, Shared Credentials); `react/docker/containers/ItemView/ContainerStatusSection/NameRow.test.tsx` ("(CE)") | Several CE/BE switches are checked; the BE feature indicators and upsell pages from `feature-flags/enums.ts` have no test. |

### API – REST API and automation

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-API-01 | doc only | none | Documentation only, not a coverage target (C-06). |
| REQ-API-02 | direct | `api/http/security/bouncer_test.go`: `Test_extractAPIKeyHeader`, `Test_apiKeyLookup`, `Test_mwAuthenticateFirst_rejectsBothAPIKeyAndBearerToken`, `TestTokenScope_*`; `api/apikey/*_test.go`; `api/jwt/*_test.go` | |
| REQ-API-03 | not in repo | none | Terraform provider is a separate project. |
| REQ-API-04 | not in repo | none | MCP server is a separate project. |

### DED – Requirements deduced from code

Accepted on 2026-11-09 (COV-007, C-13 and L-01 to L-13). Phase C writes the boundary tests (at the limit, just inside, just over, zero or negative, overflow) where a limit exists; where the requirement is "no bound", the test pins that a large value is accepted.

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| REQ-DED-01 | direct | `api/git/update/validate_test.go`: `Test_ValidateAutoUpdate`; `react/portainer/gitops/sources/components/IntervalField.test.ts` | Just inside (`1m`) and overflow are not asserted. |
| REQ-DED-02 | partial | `api/adminmonitor/admin_monitor_test.go`: `Test_start_shouldDisableInstanceAfterTimeout_ifNotInitialized` and lifecycle tests | Timeout behaviour is tested with short durations; the fixed 5 minutes in `api/http/server.go` is not asserted. |
| REQ-DED-03 | untested | none | Default `8h` appears only in marshal fixtures. |
| REQ-DED-04 | untested | none | Default `5m` appears only in marshal fixtures. | Also `api/cmd/portainer/local_docker_startup_test.go`: `TestREQ_DED_04_*` (COV-044).
| REQ-DED-05 | loose | `api/jwt/jwt_kubeconfig_test.go`, `jwt_session_test.go` (set `KubeconfigExpiry = "0"`) | "0 = no expiry" is used, not asserted as the default. |
| REQ-DED-06 | untested | none | |
| REQ-DED-07 | untested | none | |
| REQ-DED-08 | untested | none | |
| REQ-DED-09 | loose | `api/http/offlinegate/offlinegate_test.go` (custom timeouts) | The 1-minute value is not asserted. |
| REQ-DED-10 | untested | none | |
| REQ-DED-11 | untested | none | |
| REQ-DED-12 | loose | `api/http/proxy/factory/docker/build_test.go`: `TestBuildOperationRemovesSpilledMultipartFilesOnSuccess` | Spilling is touched; the 32 MB threshold is not asserted. |
| REQ-DED-13 | partial | `api/http/security/rate_limiter_test.go`: `TestLimitAccess*` (built with 10/1 s/1 h) | The limiter is tested; that the four routes use it with these values is not. |
| REQ-DED-14 | partial | `api/http/security/passwordStrengthCheck_test.go`: `TestStrengthCheck` | Length check tested with given minimums; the default 12 is not asserted. | Also `api/datastore/local_docker_store_test.go`: `TestREQ_DED_14_*` (COV-040).

## Resource limits

Inputs and config values that drive allocation or resource use, found while mapping. The "Observed in code" column is what the code does today (file and line read on 2026-11-09). On 2026-11-09 the user accepted REQ-DED-01 (C-13) and decided to pin L-01 to L-13 as observed, without new caps; they are REQ-DED-02 to REQ-DED-14 in the spec (COV-007). L-14 stays an implementation detail.

### Deduced from code (accepted, COV-007)

| ID | Requirement | Source | Existing tests | Status |
|----|-------------|--------|----------------|--------|
| REQ-DED-01 | The Git automatic-update polling interval must be a valid duration of at least 1 minute. A shorter or malformed interval is rejected with 400 "interval must be at least 1 minute" / "invalid Interval format"; no upper bound. Relates to REQ-STK-03 and REQ-GIT-02. | `api/git/update/validate.go` (`d < time.Minute`); UI `app/react/portainer/gitops/sources/components/IntervalField.tsx` | `api/git/update/validate_test.go`: `Test_ValidateAutoUpdate` ("short interval value" `1s`, "incorrect interval value"); `react/portainer/gitops/sources/components/IntervalField.test.ts` | accepted, no maximum (C-13) |

### Observed limits, pinned as requirements (COV-007)

| Clarification | Input | REQ | Observed in code | Above the limit today |
|---------------|-------|-----|------------------|------------------------|
| L-01 → REQ-DED-02 | Admin setup timeout | AUTH-01 | 5 min, hard-coded (`adminmonitor.New(5*time.Minute, …)` in `api/http/server.go`) | Instance is disabled; UI redirect with reason `AdminInitTimeout` |
| L-02 → REQ-DED-03 | Session lifetime | AUTH-07 | default `8h` (`DefaultUserSessionTimeout`); any value `time.ParseDuration` accepts, including `0` and negative | not bounded |
| L-03 → REQ-DED-04 | Snapshot interval | ENV-12, SET-01, SRV-04 | default `5m`; `--snapshot-interval` and `PUT /settings` accept any parseable duration | not bounded |
| L-04 → REQ-DED-05 | Kubeconfig expiry | K8S-20 | default `0` (no expiry); any parseable duration | not bounded |
| L-05 → REQ-DED-06 | Edge agent check-in interval | SET-01, EDGE-01 | default 5 s (`DefaultEdgeAgentCheckinIntervalInSeconds`); integer, no validation in `settings_update.go` | not bounded |
| L-06 → REQ-DED-07 | Multipart file uploads read into memory | BKP-02, STK-02, TPL-03, SET-04 | `pkg/libhttp/request.RetrieveMultiPartFormFile` reads the whole file with `io.ReadAll`; no size cap | memory grows with the upload |
| L-07 → REQ-DED-08 | Backup timeout | BKP-01 | `PORTAINER_BACKUP_TIMEOUT`, default 1 h (`api/filesystem/copy.go`); invalid value falls back to default | backup aborts |
| L-08 → REQ-DED-09 | Request wait while the store is locked (restore) | BKP-02 | 1 min (`offlineGate.WaitingMiddleware(time.Minute, …)`) | request fails |
| L-09 → REQ-DED-10 | Notification history size | LOG-04 | bell shows 50 (`NotificationsMenu.tsx`, stated in the spec); the stored history itself has no bound found | history keeps growing |
| L-10 → REQ-DED-11 | Container log line count | CTR-10 | UI default 100 lines (`containerLogsController.js`); user-editable, no maximum found | Docker returns that many lines |
| L-11 → REQ-DED-12 | Image build upload | IMG-03 | multipart parsed with 32 MB in memory, rest spilled to temp files (`api/http/proxy/factory/docker/build.go`); no total cap | disk grows with the upload |
| L-12 → REQ-DED-13 | Authentication rate limit | AUTH-03, AUTH-09, AUTH-11 | 10 requests per 1 s per client IP, then banned for 1 h (`NewRateLimiter(10, time.Second, time.Hour, …)`), on `POST /auth`, OAuth validate, password change, token creation | 403 "Access denied" |
| L-13 → REQ-DED-14 | Minimum password length | AUTH-01, AUTH-03, AUTH-09 | default 12 (`api/datastore/init.go`), configurable in `PUT /settings`; no bound on the setting found | password rejected |
| L-14 (no REQ) | Other caches and batches | SRV-04, AUTH-11, GIT-02, STK-02 | `--max-batch-size` 1000, `--max-batch-delay` 20 ms, `--initial-mmap-size` unset; API key cache 1,024 entries (LRU); Git repository cache 4 entries, 5 min TTL; compose `COMPOSE_PARALLEL_LIMIT` (0 = unlimited); list pagination `limit=0` returns all items, no maximum page size | not bounded / evicted |

Phase C writes the boundary tests (at, just inside, just over, zero or negative, overflow) for REQ-DED-01 to REQ-DED-14. L-14 gets none.

## Clarifications during tests

Questions raised while mapping. The user decides; an empty Decision means open. Commit is the commit that records the decision in the spec or here. All 27 were decided by the user on 2026-11-09 and recorded in COV-007.

| No. | Requirement | Question | Decision | Commit |
|-----|-------------|----------|----------|--------|
| C-01 | REQ-STK-09 | The spec marks stack webhooks as BE-only, but CE serves `POST /stacks/webhooks/{id}` and the CE create/edit forms set webhook IDs for editor and Git stacks (tests in `webhook_invoke_test.go`, `CreateStackForm.webhook.test.tsx`, `StackEditorTab.webhook.test.tsx`). Is the stack webhook a CE requirement (and only pull prevention and environment variables BE-only), or should REQ-STK-09 stay BE-only? | CE feature; the spec was too narrow. Only pull prevention and environment variables on the webhook call stay BE-only. Spec REQ-STK-09 amended. (user, 2026-11-09) | `394275708` (COV-007) |
| C-02 | REQ-TPL-04, REQ-K8S-04 | The spec marks template variables as BE-only, but CE creates, validates and fills custom template variables (tests in `customtemplate_create_test.go`, `CustomTemplatesVariablesField`, `useTemplateInitialization`). Are template variables a CE requirement? | CE feature (REQ-TPL-04 and the variables in REQ-K8S-04). Spec amended. (user, 2026-11-09) | `394275708` (COV-007) |
| C-03 | REQ-K8S-09 | The spec says scaling and rolling restart of Kubernetes applications are BE-only, but CE has scale, patch, rollback and pod restart handlers with tests (`workload_write_test.go`, `pod_test.go`). Which of these are CE requirements? | Scale, patch, rollback and pod restart are all CE features in the current tree. Spec REQ-K8S-09 amended; YAML editing stays BE-only. (user, 2026-11-09) | `394275708` (COV-007) |
| C-04 | REQ-EDGE-02 | The spec says Edge async mode is BE-only, but CE renders and tests async interval fields and async agent scripts (`EdgeEnvironmentForm`, `EdgeIntervalsFieldset`, `scripts.test.ts`). Is async mode in CE scope? | Edge async mode is a CE feature in the current tree. Spec REQ-EDGE-02 amended. (user, 2026-11-09) | `394275708` (COV-007) |
| C-05 | REQ-SET-03 | The SSRF protection has an enforcing and an audit mode and covers Git, Helm, compose URLs and the proxy dialer. Which default (off, audit, enforce) and which destinations are the requirement? | Pin current behaviour: default off (`SSRFModeOff`); destinations as implemented (Git, Helm, compose URLs, proxy dialer). Spec REQ-SET-03 amended. (user, 2026-11-09) | `394275708` (COV-007) |
| C-06 | REQ-API-01 | "All UI functions are available over the REST API, described by OpenAPI/Swagger" cannot be checked by a unit test as written. Should it become a check that `api/docs/openapi.yaml` lists every registered route, or stay documentation-only (untested by design)? | Documentation only, not a coverage target. Status `doc only`. (user, 2026-11-09) | `394275708` (COV-007) |
| C-07 | REQ-USR-05 | CE assigns built-in roles in environment access policies and resolves them by priority (`pkg/authorization`). Is "built-in roles in access policies" a CE requirement separate from the BE role editor? | Built-in roles in access policies are a CE requirement, separate from the BE role editor. Spec REQ-USR-05 amended; status partial. (user, 2026-11-09) | `394275708` (COV-007) |
| C-08 | REQ-SRV-02, REQ-SRV-03, REQ-AUTH-14, REQ-API-03, REQ-API-04 | These describe things outside this repository (install guides, the Agent, the reset-password helper, Terraform, the MCP server). Should they stay in the spec as untestable here, or move to a "not tested in this repo" status? | Status "not tested in this repo" (`not in repo`); they stay in the spec. (user, 2026-11-09) | `394275708` (COV-007) |
| C-09 | REQ-AUTH-03 | The login handler (`POST /auth`) has no test. Is the expected behaviour on a wrong password, unknown user and disabled internal auth (status codes and messages) what the code does today, so phase C can pin it, or does the user want different behaviour? | Pin today's `POST /auth` behaviour (400 bad payload; 422 "Invalid credentials" for wrong password and unknown user; 422 for OAuth-only and unsupported method); no new login UX. Spec REQ-AUTH-03 amended. (user, 2026-11-09) | `394275708` (COV-007) |
| C-10 | REQ-USR-01 | `api/http/handler/users/user_update_test.go` `Test_updateUserRemovesAccessTokens` tests deleting a user, not updating one. Should an update of a user (for example a role change) remove the user's access tokens, as the test name suggests? | No. An update does not revoke tokens; no requirement that a role change revokes them. The misnamed test checks delete and stays as is. (user, 2026-11-09) | `394275708` (COV-007) |
| C-11 | REQ-LOG-04 | Where is the notification history stored, and should it be bounded (see L-09)? | Stored as today; bell display limit 50 stays; stored history unbounded for now (REQ-DED-10). (user, 2026-11-09) | `394275708` (COV-007) |
| C-12 | REQ-AUTH-05, REQ-IMG-08, REQ-REG-04, REQ-BKP-03, REQ-ALR-01, REQ-LIC-01 | CE contains code and tests for features the spec calls BE-only (AD settings parser, image up-to-date status, registry tag table, backup-failed panel, Prometheus/Alertmanager library, license client and node panel). Keep them as BE-absent in the test spec (no CE tests planned), or treat the CE parts as requirements? | Not CE requirements; they stay BE-absent and get no new tests that lock them in. (user, 2026-11-09) | `394275708` (COV-007) |
| C-13 | REQ-DED-01 | Accept the deduced requirement REQ-DED-01 (Git polling interval at least 1 minute, no maximum)? If accepted, should it get an upper bound? | Accept REQ-DED-01 (at least 1 minute, 400 if shorter or malformed); no maximum. (user, 2026-11-09) | `394275708` (COV-007) |
| L-01 | REQ-AUTH-01 | Keep the 5-minute admin setup timeout as the requirement, make it configurable, or change it? | Pin as observed: 5 min, fixed (REQ-DED-02). (user, 2026-11-09) | `394275708` (COV-007) |
| L-02 | REQ-AUTH-07 | Minimum and maximum session lifetime? What should happen for `0` or a negative value? | Pin as observed: default 8h, any parseable duration, no new bound (REQ-DED-03). (user, 2026-11-09) | `394275708` (COV-007) |
| L-03 | REQ-ENV-12, REQ-SET-01 | Minimum (and maximum) snapshot interval? What should happen for `0`, negative or very short values? | Pin as observed: default 5m, any parseable duration, no new bound (REQ-DED-04). (user, 2026-11-09) | `394275708` (COV-007) |
| L-04 | REQ-K8S-20 | Minimum and maximum kubeconfig expiry; is `0` = never the requirement? | Pin as observed: default 0 = no expiry, no maximum (REQ-DED-05). (user, 2026-11-09) | `394275708` (COV-007) |
| L-05 | REQ-SET-01, REQ-EDGE-01 | Valid range of the Edge agent check-in interval? | Pin as observed: default 5 s, no range check (REQ-DED-06). (user, 2026-11-09) | `394275708` (COV-007) |
| L-06 | REQ-BKP-02, REQ-STK-02, REQ-TPL-03, REQ-SET-04 | Maximum size of uploaded files (restore archive, stack file, `.env`, template file, TLS file), and the response above it (for example 413)? | Pin as observed: no size cap; a cap would be a product change (REQ-DED-07). (user, 2026-11-09) | `394275708` (COV-007) |
| L-07 | REQ-BKP-01 | Keep the 1-hour backup timeout and the `PORTAINER_BACKUP_TIMEOUT` override as the requirement? Valid range? | Pin as observed: 1 h default, `PORTAINER_BACKUP_TIMEOUT` override, invalid falls back (REQ-DED-08). (user, 2026-11-09) | `394275708` (COV-007) |
| L-08 | REQ-BKP-02 | Keep the 1-minute wait for requests while a restore holds the store? | Pin as observed: 1 minute (REQ-DED-09). (user, 2026-11-09) | `394275708` (COV-007) |
| L-09 | REQ-LOG-04 | Besides the 50 items behind the bell (in the spec), how many notifications should the history keep? | Bell shows 50 (spec); stored history unbounded (REQ-DED-10, C-11). (user, 2026-11-09) | `394275708` (COV-007) |
| L-10 | REQ-CTR-10 | Default and maximum number of log lines fetched? | Pin as observed: default 100 lines, no maximum (REQ-DED-11). (user, 2026-11-09) | `394275708` (COV-007) |
| L-11 | REQ-IMG-03 | Maximum build-context upload size? | Pin as observed: 32 MB in memory, rest spilled, no total cap (REQ-DED-12). (user, 2026-11-09) | `394275708` (COV-007) |
| L-12 | REQ-AUTH-03, REQ-AUTH-09, REQ-AUTH-11 | Keep 10 requests per second per client and a 1-hour ban as the authentication rate limit? | Pin as observed: 10 per second per client IP, then 1 h ban, 403 (REQ-DED-13). (user, 2026-11-09) | `394275708` (COV-007) |
| L-13 | REQ-AUTH-03, REQ-AUTH-09 | Valid range of the configurable minimum password length (default 12)? | Pin as observed: default 12, no range check on the setting (REQ-DED-14). (user, 2026-11-09) | `394275708` (COV-007) |
| L-14 | REQ-SRV-04, REQ-AUTH-11, REQ-GIT-02, REQ-STK-02, REQ-ENV-01 | Should the DB batch size/delay, API key cache size, Git repository cache, compose parallel limit and the maximum list page size become requirements with limits, or stay implementation details? | Implementation details, not product requirements; no REQ, no boundary tests. (user, 2026-11-09) | `394275708` (COV-007) |

## Coverage plan (phase C)

Baseline remeasured on 2026-11-09 at `2-covered@7476f68ef` (docs `0769c07f2`) with `nix develop -c make test` after COV-009 (`coverage.include: ['app/**']`, vision-aware Priority/Deferred order): **32.7 %** of statements project-wide (Go 40.8 %, 13,228 of 32,392; client 25.2 %, 8,890 of 35,322). Overshoot target 95.5 % (needs 42,549 more covered). Priority packages alone reach at most about 67.4 %; COV-012 closes that open point by ending covered after Priority without testing Deferred (no new percentage bar). The two-tier package plan is in [portainer-test-strategy.md](portainer-test-strategy.md) section 9. Prior COV-008 figure (48.8 %, loaded client files only) is superseded for planning. New tests are mapped here as they are added. COV-010 started Priority package `api/http/handler/stacks` (first batch: stop/inspect/associate/response; 33.0 % → 40.3 %, missed 1,159 → 1,034). COV-011 continued it (create/migrate/list/git guards; 40.3 % → 52.0 %, missed 1,034 → 831). COV-013 continued it (compose git create/upload, git update/redeploy success, compose update HTTP, authz; 52.0 % → 64.5 %, missed 831 → 615). COV-014 continued compose edges/async deploy/swarm migrate-update HTTP (64.5 % → 68.1 %, missed 615 → 553). COV-015 moved the non-admin helper into a `*_test.go` file. COV-016 closed Priority stacks with swarm/k8s create/update as deferred-within-package. COV-017 started Priority `api/http/handler/endpoints` (local-Docker inspect/settings/snapshot/unique-name/delete-batch/update; 38.5 % → 46.9 %, missed 1,013 → 874). COV-018 continued (filter/create/update/dockerhub; 46.9 % → 60.7 %, missed 874 → 647). COV-019 continued (list/filter/create validate/update TLS/delete; 60.7 % → 64.6 %, missed 647 → 583; +64, diminishing). COV-020 closed Priority endpoints (thin local leftovers). COV-021 started Priority `api/datastore/migrator` (25.5 % → 42.6 %, missed 870 → 671; +199). COV-022 continued (42.6 % → 61.2 %, missed 671 → 453; +218; DB31 registry/kube/helm deferred-within-package). COV-023 continued (61.2 % → 63.5 %, missed 453 → 426; +27; DB34/DB140 deferred-within-package). COV-024 closed Priority migrator (thin local leftovers). COV-025 started Priority `app/portainer/services/api` (0 % → 28.3 %, missed 690 → 495; +195). COV-027 continued (28.3 % → 50.4 %, missed 495 → 342; +153; backup deferred-within-package). COV-028 continued (50.4 % → 55.4 %, missed 342 → 308; +34). COV-029 closed Priority api services (deferred-dominated leftovers). COV-030 started Priority `api/http/proxy/factory/docker` (volume/container proxy; 44.8 % → 54.6 %, missed 615 → 506; +109). COV-031 continued (findResourceControl/inherited labels/inspect/update/getDockerID; 54.6 % → 65.3 %, missed 506 → 387; +119). COV-032 continued (creation security/existence-check/restrictedResource/local build; 65.3 % → 70.3 %, missed 387 → 331; +56; registry-auth deferred-within-package). COV-033 closed Priority docker proxy (thin local leftovers). COV-034 started Priority `api/filesystem` (23.1 % → 68.4 %, missed 489 → 201; +288; edge/registry/chisel/MTLS deferred-within-package). COV-035 closed Priority filesystem (thin local leftovers). COV-036 started Priority `app/portainer/services` (exclude api/; 9.6 % → 79.0 %, missed 435 → 101; +334; registry/edge/kube/backup/swarm-upload deferred-within-package). Parallel `app/docker/helpers` batch merged (8.15 % → 61.68 %, +197). COV-037 closed Priority docker helpers (swarm service/secret/config/node/task deferred-within-package). COV-038 closed Priority parent services (thin local leftovers). Parallel `api/stacks/deployments` batch merged (29.4 % → 51.0 %, +108). COV-039 closed Priority deployments (swarm/k8s/remote deferred-within-package; remote compose mostly uncoverable in unit tests). Parallel `api/datastore` batch merged (40.0 % → 67.1 %, +171). COV-040 closed Priority datastore (not migrator; backup/edge/registry/user/helm deferred-within-package; encryptDB uncoverable via log.Fatal). Parallel `api/http/handler/endpointgroups` batch merged (26.6 % → 77.0 %, +180). COV-041 closed Priority endpointgroups (user/team/edge/k8s/registry/azure deferred-within-package; thin local leftovers). Parallel `app/docker/models` batch merged (isolated 7.0 % → 51.3 %, +132). COV-042 closed Priority docker models (local models 100 %; swarm service/node/config/task/secret deferred-within-package). Parallel `api/docker/images` batch merged (29.6 % → 50.0 %, +67). COV-043 closed Priority docker images (registry-auth deferred-within-package; IMG-08 BE-absent; thin TrimDigest leftover). Parallel `api/cmd/portainer` batch merged (13.9 % → 68.2 %, +161). COV-044 closed Priority cmd/portainer (kube/swarm/edge/backup/login deferred-within-package; Fatal/os.Exit uncoverable). Parallel `api/http/handler/websocket` batch merged (27.5 % → 51.5 %, +73). COV-045 closed Priority websocket (k8s/edge/agent deferred-within-package; thin uncoverable NewRequest/keepalive leftovers). Parallel `api/database/boltdb` batch merged (38.7 % → 91.4 %, +177). COV-046 closed Priority boltdb (no deferred-within-package; thin/hard error-injection leftovers only). COV-012: exit covered after Priority without testing Deferred.

### Uncoverable methods and functions

None recorded yet. Each entry will name the source, the function and the call that makes it uncoverable (for example process exit).

### Deferred-within-package (vision-aware skip, not uncoverable)

These sources are testable but skipped under COV-012 / COV-016 while finishing Priority packages: the tailored stage is expected to remove the Deferred feature. They remain in the coverage denominator.

| Package | Source | Reason |
|---------|--------|--------|
| `api/http/handler/stacks` | `create_swarm_stack.go` | Swarm create; Deferred-feature code |
| `api/http/handler/stacks` | `create_kubernetes_stack.go` | Kubernetes create; Deferred-feature code |
| `api/http/handler/stacks` | `update_kubernetes_stack.go` | Kubernetes update; Deferred-feature code |
| `api/http/handler/endpoints` | `endpoint_force_update_service.go` | Swarm force-update; Deferred-feature code |
| `api/http/handler/endpoints` | `update_edge_relations.go` | Edge relations; Deferred-feature code |
| `api/http/handler/endpoints` | `endpoint_association_delete.go` | Edge association; Deferred-feature code |
| `api/http/handler/endpoints` | `endpoint_registry_access.go` | Kubernetes registry access; Deferred-feature code |
| `api/http/handler/endpoints` | `endpoint_registries_list.go` | Mostly Kubernetes registry listing; Deferred-feature code |
| `api/http/handler/endpoints` | `endpoint_create.go` (`createAzureEndpoint`, `createKubernetesEndpoint`) | Azure/Kubernetes create; Deferred-feature code |
| `api/http/handler/endpoints` | `endpoint_status_inspect.go` | Deprecated Edge status inspect; Deferred-feature code |
| `api/http/handler/endpoints` | `endpoint_update_relations.go` | Bulk Edge/relations update; Deferred-feature code |
| `api/datastore/migrator` | `migrate_2_31_0.go` | Edge stack statuses; Deferred-feature code |
| `api/datastore/migrator` | `migrate_2_32_0.go` | Edge agent endpoint relations; Deferred-feature code |
| `api/datastore/migrator` | `migrate_dbversion40.go` | Edge endpoint trust; Deferred-feature code |
| `api/datastore/migrator` | `migrate_dbversion70.go` / `migrate_dbversion80.go` (kube detect) | Kubernetes ingress/metrics/storage detection; Deferred-feature code |
| `api/datastore/migrator` | registry/dockerhub-only helpers (`updateRegistries*`, `updateDockerhubToDB32`) | Registries Deferred-feature code |
| `api/datastore/migrator` | `migrate_dbversion31.go` registry/kube/helm slices (`updateRegistriesToDB32`, `updateDockerhubToDB32`, `kubeconfigExpiryToDB32`, `helmRepositoryURLToDB32`) | Registries/Kubernetes Deferred-feature code; volume RC slice covered in COV-022 |
| `api/datastore/migrator` | `migrate_dbversion32.go` (kubectl shell image) | Kubernetes Deferred-feature code |
| `api/datastore/migrator` | `migrate_dbversion100.go` `updateEdgeStackStatusForDB100` | Edge Deferred-feature code; seed→key covered in COV-022 |
| `api/datastore/migrator` | `migrate_dbversion110.go` `updateResourceOverCommitToDB110` | Kubernetes Deferred-feature code |
| `app/portainer/services/api` | `registryService.js` | Registries Deferred-feature code |
| `app/portainer/services/api` | `dockerhubService.js` | Registries Deferred-feature code |
| `app/portainer/services/api` | `userService.js` / `teamService.js` / `teamMembershipService.js` | User-admin surfaces deferred-within-package under local-Docker preference |
| `app/portainer/services/api` | EndpointService `createAzureEndpoint` / `createLocalKubernetesEndpoint` | Azure/Kubernetes Deferred-feature code |
| `app/portainer/services/api` | StackService `updateKubeGit` / swarm-only paths | Kubernetes/Swarm-heavy deferred-within-package for this Priority pass |
| `app/portainer/services/api` | `backup.service.ts` / `backupService.js` | Backup/restore removed by vision; existing getBackupStatus test left; no further backup deepening |
| `app/portainer/services/api` | StackService swarm create/associate/kube (`createSwarm*`, `swarmStacks`, `externalSwarmStacks`, `updateKubeStack`, `kubernetesDeploy`, swarm associate branch) | Swarm/Kubernetes Deferred-feature code; compose paths covered |
| `app/portainer/services/api` | EndpointService agent/azure/k8s/registry leftovers (`createAzureEndpoint`, `createLocalKubernetesEndpoint`, `registries`/`updateRegistryAccess`) | Azure/Kubernetes/registry Deferred-feature code |
| `api/datastore/migrator` | `migrate_dbversion34.go` (`migrateDBVersionToDB35` → dockerhub) | Registries Deferred-feature code |
| `api/datastore/migrator` | `migrate_dbversion140.go` (`migrateRegistryAccessSASecrets_2_40_0`) | Kubernetes/registry Deferred-feature code |
| `api/datastore/migrator` | `migrate_dbversion17.go` `updateRegistriesToDBVersion18` | Registries Deferred-feature code |


## Behaviour without a requirement ID (backwards compatibility)

Observed behaviour that existing tests pin but that no requirement states. It is not promoted to a product requirement. Phase C puts tests for it in the "Backwards compatibility tests" section and labels them as such; none are written yet.

### Backwards compatibility tests

Phase C additions:

- `api/database/boltdb/local_store_test.go`: path helpers, Close(nil), connection/tx CRUD, BackupMetadata/RestoreMetadata, ExportJSON/ExportRaw (COV-046) — store wiring without a dedicated REQ (BKP-01 / SRV-07 mapped separately).
- `api/datastore/local_docker_store_test.go`: `TestStore_LocalServiceAccessorsAreWired`, `TestStore_UpdateTxAndViewTx_LocalDockerEntities`, `TestStore_CheckCurrentEditionAndConnection`, `TestStore_BackupToWriter`, `TestStore_IsErrObjectNotFound`, `TestStore_ExportImport_LocalDockerRoundTrip`, `TestStore_InitFillsEmptyUserSessionTimeout`, `TestStore_InitRespectsDockerExtensionEnv`, `TestStore_AllowListUpdateAndRead` (COV-040) — store wiring / export roundtrip without a dedicated REQ (SET-01 / DED-14 mapped separately).
- `api/stacks/deployments/deploy_local_extra_test.go`: `Test_StackAuthorMissingErr_Error`, `Test_isEnvironmentOnline_LocalDocker`, `Test_getUnpackerImage`, `Test_getTargetSocketBindHostAndContainer`, `Test_isNotInASwarm`; compose unpacker helpers `Test_append*`, `Test_getEnv`, `Test_buildUnpackerCmdForStack_UnknownOperation` (COV-039).
- `app/docker/helpers/splitargs.test.ts` (existing) plus thin leftover noted under COV-037 close; swarm service/secret/config/node/task helpers deferred-within-package (COV-037).
- `app/portainer/services/session-storage.test.ts`, `allSettled.test.js`, `async.test.js`, `angularToReact.test.ts`, `dockerMaxApiVersionInterceptor.test.ts`, `terminal-window.test.ts`, `angularFactoryHelpers.test.js` (COV-036) — parent services helpers without a dedicated REQ.

- `api/datastore/migrator/migrate_local_docker_test.go`: `TestMigrate_*` (COV-021) — local-Docker endpoint/stack/settings/user DB migrations and migrator core helpers (also mapped under REQ-SRV-09).
- `api/datastore/migrator/migrate_local_docker_batch2_test.go`: `TestMigrate_*` (COV-022) — volume RC DB32, tags/endpoints DB23, RC/users/roles DB22, settings/schedules DB20, seed→key DB100, 2.43 UAC helpers, NeedsMigration count, DB19/30/36/130 (also mapped under REQ-SRV-09).
- `api/http/handler/stacks/response_test.go`: `TestNewStackResponse_WithoutWorkflow_ReturnsStackOnly`, `TestFillStackGitConfig_WithoutWorkflow_IsNoop` (COV-010) — stack JSON helpers when no GitOps workflow is attached.
- `api/http/handler/stacks/handler_authz_test.go`: `TestREQ_STK_02_UserIsAdmin_*`, `UserCanManageStacks_*`, `UserCanAccessStack_*`, `StackExistsError_*`, `CheckUniqueStackNameInDocker_*` (COV-013) — handler authorisation helpers for compose stack access.
- `api/http/handler/stacks/create_compose_file_upload_test.go`: `TestREQ_STK_02_CreateComposeFromFileUpload_*` (COV-013) — standalone compose create from multipart file upload.
- `api/http/handler/stacks/create_compose_git_test.go`: `TestREQ_STK_02_CreateComposeFromGit_*` (COV-013) — standalone compose create from SourceID / RepositoryURL.
- `api/http/handler/stacks/stack_update_git_compose_test.go`: `TestREQ_STK_03_RedeployComposeGit_*`, `TestREQ_STK_04_UpdateGitCompose_*` (COV-013) — compose git update and redeploy success/error paths.

Candidates found while mapping:

- Database migrations per version (`api/datastore/migrate_*_test.go`, `api/datastore/migrator/*_test.go`, `api/datastore/postinit`, `api/datastore/pendingactions_test.go`).
- Deprecated API routes and their redirects (`api/http/middlewares/deprecated_test.go`).
- List query parameters: search, sort, pagination and filter semantics, including `limit=0` (`api/http/utils/filters/*_test.go`, `pkg/libhttp/request/*_test.go`, `react/common/api/common.test.ts`).
- Agent request signing and the FIPS mode switch (`*_SignsOnlyOutsideFIPSMode`, `*_FIPSModeNeverCreatesSignature` in `api/docker/client`, `api/http/proxy/factory/**`, `api/http/handler/websocket`, `api/kubernetes/cli`; `pkg/fips`).
- Rejecting encoded path separators in the Docker proxy (`TestTransport_ProxyDockerRequest_rejectsEncodedSeparator`, `pkg/libhttp/request/docker_version_test.go`).
- Archive path traversal and symlink rejection (`api/archive/targz_test.go`: `TestExtractTarGzPathTraversal`; `api/git/git_test.go`: `Test_noSymlinkFS_*`, `Test_Download_RejectsSymlink`).
- Kubeconfig token scope confined to the Kubernetes proxy (`api/http/security/bouncer_test.go`: `TestTokenScope_*`; `api/jwt/jwt_scope_test.go`).
- Local-request check (`pkg/libhttp/localcheck_test.go`).
- Pending actions run after restart (`api/pendingactions/**`).
- Panic recovery and HTTP logging (`api/http/middlewares/panic_logger_test.go`, `api/http/logger_test.go`).
- Error-response parsing in the client (`react/portainer/services/axios/utils/defaultAxiosParser.test.ts`).
- Login redirect handling (`returnUrl`) (`portainer/views/auth/authController.test.js`).
- Generic UI components without a feature (`react/components/**` such as buttons, datatables, form components, page header, command palette).
- Generic helpers (`api/slicesx`, `api/set`, `api/roar`, `api/concurrent`, `pkg/retry`, `pkg/schedule`, `pkg/librand`, `api/internal/randomstring`, `react/utils`, `react/common/*-utils`).
