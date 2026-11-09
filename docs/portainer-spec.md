# Portainer CE feature spec (raw stage)

Upstream feature list for `bespoke-portainer-ce`, written in the raw stage (decision RAW-013 in [BESPOKE.md](../BESPOKE.md)). It describes what Portainer offers at tag 2.45.3 (upstream commit `0fa764dc81c76bb7914d65d8e62b026d7c746899`). It is not the target product: features the vision removes are listed here on purpose, and later stages mark them as removed instead of deleting them silently.

## Sources and conventions

- Source of truth: the official product documentation at https://docs.portainer.io/ (index: https://docs.portainer.io/llms.txt; pages read as Markdown on 2026-11-09). Each requirement names the docs page it comes from as `docs: <path>` (relative to https://docs.portainer.io/, append `.md` for Markdown).
- The docs describe the current 2.45 release and are written for Business Edition (BE) first. A requirement marked **BE-only** is described in the docs as a Portainer feature but flagged there as "only available in Portainer Business Edition". It is listed so later stages know what exists upstream versus what CE already lacks. Where CE shows such a feature only as a disabled upsell, that is noted.
- Entry points were checked against the tree at 2.45.3: UI routes from the AngularJS/React router (`app/`), REST routes from `api/docs/swagger.yaml`, CLI flags from `api/cli/cli.go`. UI routes use the hash form `#!/…`; `{envId}` is the environment ID. REST routes are relative to `/api`. Docker and Kubernetes resources are reached through the Portainer proxy `/api/endpoints/{id}/docker/…` and `/api/endpoints/{id}/kubernetes/…`, which forwards the native Docker/Kubernetes API (inferred from code: `api/http/handler/endpointproxy`).
- Anything taken only from code, with no docs page behind it, is marked `(inferred from code)`.
- IDs are `REQ-<AREA>-NN`. IDs are stable; later stages change the status of a requirement, they do not renumber.

## Areas

| Area | Scope |
|------|-------|
| SRV | Server installation, runtime, CLI, TLS, database |
| AUTH | Initial setup, login, authentication methods, own account |
| USR | Users, teams, roles, resource access control |
| ENV | Home screen, environments, groups, tags, environment updates |
| POL | Environment policies |
| HOST | Docker environment dashboard, host, events |
| CTR | Docker containers |
| IMG | Docker images |
| NET | Docker networks |
| VOL | Docker volumes |
| STK | Docker stacks (Compose) |
| SWM | Docker Swarm: cluster, services, configs, secrets |
| TPL | App templates and custom templates |
| GIT | App Delivery (GitOps workflows and sources) |
| REG | Registries |
| K8S | Kubernetes environments |
| ACI | Azure Container Instances |
| EDGE | Edge Compute |
| SET | Global settings |
| BKP | Backup and restore |
| LOG | Logs and notifications |
| ALR | Alerting, recommendations, add-ons |
| LIC | Licensing and Business Edition upgrade/advertising |
| API | REST API and automation |

## SRV – Server installation and runtime

- **REQ-SRV-01 Run as a container on Docker Standalone.** Portainer Server runs as a container with the Docker socket and a `portainer_data` volume mounted; UI on HTTPS port 9443 with a self-signed certificate, optional HTTP 9000, optional tunnel port 8000 for Edge Agents. Entry: `docker run … portainer/portainer-ce`; CLI `--bind`, `--bind-https`, `--tunnel-addr`, `--tunnel-port`, `--data`, `--assets`. docs: start/install-ce/server/docker/linux
- **REQ-SRV-02 Other install targets.** Install on Docker Swarm (as a stack with the Agent), Kubernetes (Helm chart or manifests), Podman, WSL/Docker Desktop and Windows Container Service. docs: start/install-ce/server/*, advanced/helm-chart-configuration-options
- **REQ-SRV-03 Portainer Agent.** A separate agent container that gives the server access to a remote Docker, Swarm, Podman or Kubernetes host (needed for host browsing and volume browsing). docs: start/agent, start/architecture
- **REQ-SRV-04 Command-line configuration.** Server behavior is set by CLI flags, among them `--host` (initial environment), `--admin-password`/`--admin-password-file`, `--hide-label`, `--logo`, `--templates`, `--snapshot-interval`, `--base-url`, `--log-level`, `--log-mode`, `--http-disabled`/`--http-enabled`, `--trusted-origins`, `--csp`, `--compact-db`, `--feat`, `--rollback`. docs: advanced/cli
- **REQ-SRV-05 Own TLS certificate and HTTPS-only.** Serve the UI with a user-supplied certificate and key, optionally HTTPS only. Entry: CLI `--tlscert`, `--tlskey`, `--tlscacert`, `--tlsverify` (deprecated aliases `--ssl`, `--sslcert`, `--sslkey`), `--http-disabled`; UI `#!/settings` (SSL certificate); API `GET/PUT /ssl`. docs: advanced/ssl, admin/settings/general
- **REQ-SRV-06 mTLS for Edge Agent traffic.** **BE-only.** docs: advanced/mtls
- **REQ-SRV-07 Database encryption.** Encrypt the BoltDB database with a secret mounted at start (not reversible). Entry: CLI `--secret-key-name`. docs: advanced/db-encryption
- **REQ-SRV-08 Reverse proxy and sub-path.** Run behind nginx or Traefik and under a relative base URL. Entry: CLI `--base-url`, `--trusted-origins`. docs: advanced/reverse-proxy, advanced/reverse-proxy/nginx, advanced/reverse-proxy/traefik
- **REQ-SRV-09 Update Portainer.** Update the server and agents to a newer version per platform, or roll the database back to the previous version. Entry: CLI `--rollback`. docs: start/upgrade, start/upgrade/docker, start/upgrade/edge
- **REQ-SRV-10 Security posture.** No behavioral analytics in CE, CSRF trusted origins, Content Security Policy header. Entry: CLI `--csp`, `--trusted-origins`, `--no-analytics` (deprecated). docs: advanced/security

## AUTH – Setup, login and own account

- **REQ-AUTH-01 Initial admin setup.** On first start the UI asks for the first administrator's username and password; a setup token protects initialization of an unclaimed instance, and the instance times out if not set up in time. Entry: UI `#!/init/admin`; API `GET /users/admin/check`, `POST /users/admin/init`; CLI `--setup-token`, `--no-setup-token`, `--admin-password`. docs: start/install-ce/server/setup, faqs/installing/setup-token
- **REQ-AUTH-02 Environment wizard after setup.** After the first login, a wizard connects the first environments (local Docker socket, agent, API, Edge). Entry: UI `#!/wizard`, `#!/wizard/endpoints`. docs: start/install-ce/server/setup, admin/environments/add
- **REQ-AUTH-03 Log in and log out with internal users.** Username/password login against Portainer's own user store, session token, logout. Entry: UI `#!/auth`, `#!/logout`; API `POST /auth`, `POST /auth/logout`. docs: admin/settings/authentication
- **REQ-AUTH-04 LDAP authentication.** Authenticate against an LDAP server, with optional automatic user provisioning and team sync. Entry: UI `#!/settings/auth`; API `POST /ldap/check`, `PUT /settings`. docs: admin/settings/authentication/ldap
- **REQ-AUTH-05 Microsoft Active Directory authentication.** **BE-only.** docs: admin/settings/authentication/active-directory
- **REQ-AUTH-06 OAuth authentication.** Log in via an OAuth provider. In CE only the custom provider is selectable; the predefined Microsoft, Google and GitHub providers are shown as BE features (inferred from code: `oauth-options.tsx`). Entry: UI `#!/settings/auth`; API `POST /auth/oauth/validate`. docs: admin/settings/authentication/oauth
- **REQ-AUTH-07 Session lifetime.** Configure how long a session stays valid before the user must log in again. Entry: UI `#!/settings/auth`. docs: admin/settings/authentication
- **REQ-AUTH-08 Login screen banner.** **BE-only.** docs: admin/settings/general
- **REQ-AUTH-09 Change own password.** Entry: UI `#!/account`; API `PUT /users/{id}/passwd`. docs: user/account-settings
- **REQ-AUTH-10 Theme and per-user application settings.** Choose light, dark or high-contrast theme and personal UI preferences. Entry: UI `#!/account`; API `PUT /users/{id}`. docs: user/account-settings
- **REQ-AUTH-11 Personal access tokens.** Create and delete API access tokens for the own user. Entry: UI `#!/account`, `#!/account/tokens/new`; API `GET/POST /users/{id}/tokens`, `DELETE /users/{id}/tokens/{keyID}`. docs: user/account-settings, api/access
- **REQ-AUTH-12 Saved Git credentials per user.** **BE-only.** docs: user/account-settings
- **REQ-AUTH-13 Personal Helm repositories.** Add and remove Helm repositories for the own user. Entry: UI `#!/account/helm-repository/new`; API `GET/POST /users/{id}/helm/repositories`, `DELETE /users/{id}/helm/repositories/{repositoryID}`. docs: user/account-settings
- **REQ-AUTH-14 Reset the admin password.** Reset a lost admin password with the password-reset helper container. docs: advanced/reset-admin

## USR – Users, teams and access control

- **REQ-USR-01 Manage users.** List, create, edit and delete Portainer users. Entry: UI `#!/users`, `#!/users/{id}`; API `GET/POST /users`, `GET/PUT/DELETE /users/{id}`, `GET /users/me`. docs: admin/user/users, admin/user/add
- **REQ-USR-02 Promote a user to administrator.** Entry: UI `#!/users/{id}`; API `PUT /users/{id}`. docs: admin/user/promote
- **REQ-USR-03 Reset a user's password (by an admin).** Entry: UI `#!/users/{id}`; API `PUT /users/{id}/passwd`. docs: admin/user/password
- **REQ-USR-04 Manage teams and team membership.** Create teams, add users, set team leaders. Entry: UI `#!/teams`, `#!/teams/{id}`; API `/teams`, `/team_memberships`, `GET /teams/{id}/memberships`, `GET /users/{id}/memberships`. docs: admin/user/teams, admin/user/teams/add, admin/user/teams/add-user
- **REQ-USR-05 Role-based access control.** Built-in roles and granular per-environment roles. **BE-only** (CE shows the roles page as an upsell; `GET /roles` exists). Entry: UI `#!/roles`. docs: admin/user/roles, advanced/docker-roles-and-permissions, advanced/kubernetes-roles-and-bindings
- **REQ-USR-06 Effective access view.** See which environments and roles a user effectively has. Entry: API `GET /users/{id}/effective-access`. docs: admin/user/roles (Viewing user access)
- **REQ-USR-07 Environment access per user/team.** Grant users and teams access to an environment or environment group. Entry: UI `#!/endpoints/{id}/access`, `#!/groups/{id}`. docs: admin/environments/environments (Manage access)
- **REQ-USR-08 Resource ownership (access control).** Resources deployed through Portainer carry an ownership of Administrators, Restricted (named users/teams) or Public; ownership can be changed later; resources created outside Portainer default to administrators. Entry: Access control section on container, stack, service, volume, network, config and secret pages; API `POST /resource_controls`, `PUT/DELETE /resource_controls/{id}`. docs: advanced/access-control, user/docker/containers/ownership

## ENV – Home and environments

- **REQ-ENV-01 Home screen.** List all environments the user can reach, with status, type, resource counts and snapshot time; search, filter, sort and group; open an environment. Entry: UI `#!/home`; API `GET /endpoints`, `GET /endpoints/summary`. docs: user/home
- **REQ-ENV-02 Build information and help.** Show the Portainer version/build and links to help from the home screen. Entry: UI build-info modal in the sidebar; API `GET /system/version`, `GET /system/info`, `GET /status`. docs: user/home
- **REQ-ENV-03 Manage environments.** List, edit (name, URL, public IP, group, tags, TLS) and remove environments. Entry: UI `#!/endpoints`, `#!/endpoints/{id}`; API `GET/POST /endpoints`, `GET/PUT/DELETE /endpoints/{id}`, `POST /endpoints/delete`. docs: admin/environments/environments
- **REQ-ENV-04 Add the local Docker environment.** Connect the Docker daemon on the Portainer host through the mounted socket. Entry: UI `#!/wizard/endpoints/create`; CLI `--host`. docs: admin/environments/add/local, admin/environments/add/docker/socket
- **REQ-ENV-05 Add a remote Docker Standalone environment.** Via Portainer Agent, Docker API (with optional TLS) or socket. docs: admin/environments/add/docker, …/docker/agent, …/docker/api
- **REQ-ENV-06 Add a Docker Swarm environment.** Via Agent, API or socket. docs: admin/environments/add/swarm and sub-pages
- **REQ-ENV-07 Add a Podman environment.** Via Agent or Podman socket. docs: admin/environments/add/podman and sub-pages
- **REQ-ENV-08 Add a Kubernetes environment.** Via Agent. docs: admin/environments/add/kubernetes, …/kubernetes/agent
- **REQ-ENV-09 Import a Kubernetes cluster from kubeconfig.** **BE-only.** docs: admin/environments/add/kubernetes/import
- **REQ-ENV-10 Create a Kubernetes cluster (Talos via Omni) and KubeSolo Edge environments.** **BE-only.** docs: admin/environments/add/kube-create, …/kube-create/omni, admin/environments/add/add-a-kubesolo-edge-environment
- **REQ-ENV-11 Add an environment via the API.** Entry: API `POST /endpoints`. docs: admin/environments/add/api
- **REQ-ENV-12 Environment snapshots.** Portainer periodically snapshots each environment for the home screen; a snapshot can be triggered manually. Entry: API `POST /endpoints/{id}/snapshot`, `POST /endpoints/snapshot`; CLI `--snapshot-interval`; UI `#!/settings`. docs: admin/settings/general (Snapshot interval)
- **REQ-ENV-13 Environment groups.** Create, edit and delete groups and assign environments. Entry: UI `#!/groups`, `#!/groups/new`, `#!/groups/{id}`; API `/endpoint_groups`, `PUT/DELETE /endpoint_groups/{id}/endpoints/{endpointId}`. docs: admin/environments/groups
- **REQ-ENV-14 Tags.** Create and delete tags and tag environments. Entry: UI `#!/tags`; API `GET/POST /tags`, `DELETE /tags/{id}`. docs: admin/environments/tags
- **REQ-ENV-15 Scheduled environment update and rollback.** Schedule Edge Agent / environment updates and rollbacks. **BE-only** (CE has the routes as upsell views). Entry: UI `#!/endpoints/update-schedules`. docs: admin/environments/update

## POL – Environment policies

- **REQ-POL-01 Policies for groups of environments.** Create, view and remove policies (Docker/Swarm/Podman RBAC, security, setup, registry and image cleanup policies; Kubernetes RBAC, security, network security, setup, registry, observability and pod security standards policies; banner and change-confirmation policy for any type) and see which apply on an environment (Host → Policies, Cluster → Policies). **BE-only.** docs: admin/environments/policies and sub-pages, user/docker/host/policies, user/kubernetes/cluster/policies

## HOST – Docker environment dashboard, host and events

- **REQ-HOST-01 Docker dashboard.** Environment info and summary tiles (stacks, containers, images, volumes, networks, GPUs, Swarm services) with links into the lists. Entry: UI `#!/{envId}/docker/dashboard`; API `GET /docker/{environmentId}/dashboard`. docs: user/docker/dashboard
- **REQ-HOST-02 Host details.** Host and Docker engine details, and with the Agent, PCI devices and physical disks. Entry: UI `#!/{envId}/docker/host`. docs: user/docker/host/details
- **REQ-HOST-03 Browse the host filesystem.** With the Agent and host management features enabled. Entry: UI `#!/{envId}/docker/host/browser`. docs: user/docker/host/setup (Host and Filesystem)
- **REQ-HOST-04 Environment setup (feature configuration).** Per-environment toggles: host management features, change window for GitOps updates, Docker security settings restricting non-admins (bind mounts, privileged mode, host namespaces, device mapping, sysctl, capabilities, container stop for non-admins), GPU display and GPU list, image up-to-date indicator (BE). Entry: UI `#!/{envId}/docker/host/feat-config` (Swarm: `#!/{envId}/docker/swarm/feat-config`); API `PUT /endpoints/{id}/settings`. docs: user/docker/host/setup, user/docker/swarm/setup
- **REQ-HOST-05 Docker events.** List engine events for the environment. Entry: UI `#!/{envId}/docker/events`. docs: user/docker/events

## CTR – Docker containers

- **REQ-CTR-01 List containers.** Table with state, stack, image, created time, IP, published ports and ownership; search, filter, sort, quick actions; hidden containers are filtered out. Entry: UI `#!/{envId}/docker/containers`. docs: user/docker/containers
- **REQ-CTR-02 Lifecycle actions.** Start, stop, kill, restart, pause, resume and remove one or many containers. Entry: UI containers list and container page; Docker API proxy. docs: user/docker/containers, user/docker/containers/view
- **REQ-CTR-03 Create a container.** Form for image (with registry), name, port mappings, publish-all, always pull, access control, auto-remove, and advanced settings: command/entrypoint/working dir/user/console, logging driver, volumes and bind mounts, network/hostname/DNS/MAC/IP, environment variables (incl. file upload), labels, restart policy, runtime and resources (privileged, init, devices, GPU, sysctls, shm, memory/CPU limits), capabilities. Entry: UI `#!/{envId}/docker/containers/new`. docs: user/docker/containers/add, user/docker/containers/advanced
- **REQ-CTR-04 Container details.** Status, ports, health, image, command, environment, labels, volumes, networks (join/leave a network, inferred from code: `ContainerNetworksDatatable/ConnectNetworkForm.tsx`), and action buttons. Entry: UI `#!/{envId}/docker/containers/{id}`. docs: user/docker/containers/view
- **REQ-CTR-05 Inspect a container.** Raw inspect JSON. Entry: UI `#!/{envId}/docker/containers/{id}/inspect`. docs: user/docker/containers/inspect
- **REQ-CTR-06 Edit, recreate or duplicate a container.** Duplicate/edit opens the create form prefilled; recreate optionally pulls the latest image. Entry: UI `#!/{envId}/docker/containers/new?from={id}`. docs: user/docker/containers/edit
- **REQ-CTR-07 Rename a container.** Entry: UI container page, name field. (inferred from code: `app/react/docker/containers/ItemView/ContainerStatusSection/EditNameForm.tsx`)
- **REQ-CTR-08 Create an image from a container (commit).** Entry: UI container page, Create image section. (inferred from code: `app/react/docker/containers/ItemView/CreateImageSection`)
- **REQ-CTR-09 Attach a volume to a container.** Entry: UI create/edit form, Volumes tab. docs: user/docker/containers/attach-volume
- **REQ-CTR-10 Container logs.** View, follow, filter, timestamp, line limit and download logs. Entry: UI `#!/{envId}/docker/containers/{id}/logs`. docs: user/docker/containers/logs
- **REQ-CTR-11 Container statistics.** Live CPU, memory, network and I/O charts and processes. Entry: UI `#!/{envId}/docker/containers/{id}/stats`. docs: user/docker/containers/stats
- **REQ-CTR-12 Console.** Exec a shell (chosen command and user) or attach to the container in the browser. Entry: UI `#!/{envId}/docker/containers/{id}/exec`, `…/attach`; API `GET /websocket/exec`, `GET /websocket/attach`. docs: user/docker/containers/console
- **REQ-CTR-13 Change container ownership.** Entry: UI container page, Access control. docs: user/docker/containers/ownership
- **REQ-CTR-14 Remove a container.** Optionally remove its anonymous volumes (option inferred from code: `ContainersDatatableActions.tsx`). docs: user/docker/containers/remove
- **REQ-CTR-15 Container webhooks.** Redeploy a container with the latest image via a webhook. **BE-only** (CE flag `CONTAINER_WEBHOOK` shows an upsell, inferred from code). docs: user/docker/containers/webhooks
- **REQ-CTR-16 GPU assignment.** Assign GPUs to containers when GPU display is enabled for the environment. Entry: create form; API `GET /docker/{environmentId}/containers/{containerId}/gpus`. docs: user/docker/host/setup, user/docker/containers/advanced

## IMG – Docker images

- **REQ-IMG-01 List images.** Table with tags, size, created date, used/unused and dangling labels; filter and remove. Entry: UI `#!/{envId}/docker/images`; API `GET /docker/{environmentId}/images`. docs: user/docker/images
- **REQ-IMG-02 Pull an image.** Simple mode (registry + image) and advanced mode (free-form name). Entry: UI images list. docs: user/docker/images/pull
- **REQ-IMG-03 Build an image.** From the web editor, an uploaded Dockerfile/tarball, or a URL; names/tags, output log. Entry: UI `#!/{envId}/docker/images/build`. docs: user/docker/images/build
- **REQ-IMG-04 Import an image.** From an uploaded tar archive. Entry: UI `#!/{envId}/docker/images/import`. docs: user/docker/images/import
- **REQ-IMG-05 Export an image.** Download selected images as a tar archive. docs: user/docker/images/export
- **REQ-IMG-06 Image details.** Tags (add, remove, push to a registry, pull), layers/history, Dockerfile details. Entry: UI `#!/{envId}/docker/images/{id}`. (inferred from code: `app/docker/views/images/edit`)
- **REQ-IMG-07 Prune dangling and unused images.** Prune removes dangling images by default, optionally all unused images, reports reclaimed space, and can clear the Docker build cache. Entry: UI images list, Prune. docs: user/docker/images/prune-dangling-and-unused-images
- **REQ-IMG-08 Image up-to-date indicator.** Show whether stacks, services and containers run the newest image. **BE-only.** docs: user/docker/host/setup

## NET – Docker networks

- **REQ-NET-01 List networks.** Entry: UI `#!/{envId}/docker/networks`. docs: user/docker/networks
- **REQ-NET-02 Create a network.** Drivers bridge, overlay, macvlan, ipvlan and others, IPv4/IPv6 configuration, labels, internal/attachable options, access control. Entry: UI `#!/{envId}/docker/networks/new`. docs: user/docker/networks/add
- **REQ-NET-03 Network details.** Options, IPAM and connected containers (disconnect a container). Entry: UI `#!/{envId}/docker/networks/{id}`. docs: user/docker/networks
- **REQ-NET-04 Remove a network.** docs: user/docker/networks/remove

## VOL – Docker volumes

- **REQ-VOL-01 List volumes.** With used/unused state, driver and mount point. Entry: UI `#!/{envId}/docker/volumes`. docs: user/docker/volumes
- **REQ-VOL-02 Create a volume.** Local, NFS, CIFS and tmpfs volumes, driver options, access control. Entry: UI `#!/{envId}/docker/volumes/new`. docs: user/docker/volumes/add
- **REQ-VOL-03 Volume details.** Driver, mount point, options and containers using the volume. Entry: UI `#!/{envId}/docker/volumes/{id}`. docs: user/docker/volumes
- **REQ-VOL-04 Browse a volume.** Upload, download, rename and delete files (needs the Agent or Swarm). Entry: UI `#!/{envId}/docker/volumes/{id}/browse`; API `POST /endpoints/{id}/docker/v2/browse/put`. docs: user/docker/volumes/browse
- **REQ-VOL-05 Remove a volume.** docs: user/docker/volumes/remove

## STK – Docker stacks

- **REQ-STK-01 List stacks.** Stacks created in Portainer (full control) and external stacks (limited control; control column inferred from code: `StacksDatatable/columns/control.tsx`). Entry: UI `#!/{envId}/docker/stacks`; API `GET /stacks`. docs: user/docker/stacks
- **REQ-STK-02 Deploy a stack from the web editor or an upload.** Compose file in the web editor or uploaded, environment variables (incl. `.env` upload), access control. Entry: UI `#!/{envId}/docker/stacks/newstack`; API `POST /stacks/create/standalone/string`, `…/standalone/file` (Swarm: `…/swarm/string`, `…/swarm/file`). docs: user/docker/stacks/add
- **REQ-STK-03 Deploy a stack from Git.** Repository URL, reference, compose path and additional files, authentication, automatic updates (polling or webhook), TLS skip, relative path volumes (BE). Entry: same UI; API `POST /stacks/create/standalone/repository`, `…/swarm/repository`. docs: user/docker/stacks/add, advanced/relative-paths
- **REQ-STK-04 Inspect and edit a stack.** See containers/services of a stack, edit the compose file and environment variables, update (optionally re-pull images), redeploy from Git, change Git settings. Entry: UI `#!/{envId}/docker/stacks/{name}`; API `GET/PUT /stacks/{id}`, `GET /stacks/{id}/file`, `POST /stacks/{id}/git`, `PUT /stacks/{id}/git/redeploy`. docs: user/docker/stacks/edit
- **REQ-STK-05 Start and stop a stack.** Entry: UI stack page; API `POST /stacks/{id}/start`, `POST /stacks/{id}/stop`. docs: user/docker/stacks/edit
- **REQ-STK-06 Create a template from a stack.** Entry: UI stack page. docs: user/docker/stacks/template
- **REQ-STK-07 Migrate, duplicate or rename a stack.** Move or copy a stack to another environment, or rename it. Entry: UI stack page; API `POST /stacks/{id}/migrate`. docs: user/docker/stacks/migrate
- **REQ-STK-08 Remove a stack.** Entry: API `DELETE /stacks/{id}`, `DELETE /stacks/name/{name}`. docs: user/docker/stacks/remove
- **REQ-STK-09 Stack webhooks.** Trigger a redeploy through a webhook URL, with pull prevention and environment variables. **BE-only.** Entry: API `POST /stacks/webhooks/{webhookID}`. docs: user/docker/stacks/webhooks
- **REQ-STK-10 Associate orphaned stacks.** Re-attach a stack to an environment. Entry: API `PUT /stacks/{id}/associate` (inferred from code; no docs page).

## SWM – Docker Swarm

- **REQ-SWM-01 Swarm cluster details.** Cluster status and node list; node details with labels, availability and engine info; browse a node (Agent). Entry: UI `#!/{envId}/docker/swarm`, `#!/{envId}/docker/nodes/{id}`, `…/browse`. docs: user/docker/swarm/details
- **REQ-SWM-02 Cluster visualizer.** Graphical view of nodes and tasks. Entry: UI `#!/{envId}/docker/swarm/visualizer`. docs: user/docker/swarm/cluster-visualizer
- **REQ-SWM-03 List and add services.** Create a service with image, replicas/global mode, ports, networks, volumes, environment, labels, secrets, configs, resources, placement, restart and update policies. Entry: UI `#!/{envId}/docker/services`, `#!/{envId}/docker/services/new`. docs: user/docker/services, user/docker/services/add
- **REQ-SWM-04 Configure a service.** Change service options after creation. Entry: UI `#!/{envId}/docker/services/{id}`. docs: user/docker/services/configure
- **REQ-SWM-05 Scale a service.** docs: user/docker/services/scale
- **REQ-SWM-06 Service tasks.** Task status, task details and task logs. Entry: UI `#!/{envId}/docker/tasks/{id}`, `…/logs`. docs: user/docker/services/tasks
- **REQ-SWM-07 Service logs.** Entry: UI `#!/{envId}/docker/services/{id}/logs`. docs: user/docker/services/logs
- **REQ-SWM-08 Roll back and force-update a service.** Entry: UI service page; API `PUT /endpoints/{id}/forceupdateservice`. docs: user/docker/services/rollback
- **REQ-SWM-09 Service webhooks.** Redeploy a service via webhook (passing environment variables is BE-only). Entry: API `GET/POST /webhooks`, `POST /webhooks/{id}`, `PUT/DELETE /webhooks/{id}`. docs: user/docker/services/webhooks
- **REQ-SWM-10 Configs.** List, add and remove Swarm configs. Entry: UI `#!/{envId}/docker/configs`, `…/new`, `…/{id}`. docs: user/docker/configs, …/add, …/remove
- **REQ-SWM-11 Secrets.** List, add and remove Swarm secrets. Entry: UI `#!/{envId}/docker/secrets`, `…/new`, `…/{id}`. docs: user/docker/secrets, …/add, …/remove

## TPL – Templates

- **REQ-TPL-01 App templates.** Browse the built-in list of application templates and deploy one as a container or stack with editable fields. Entry: UI `#!/{envId}/docker/templates`; API `GET /templates`, `POST /templates/{id}/file`. docs: user/docker/templates/application, …/deploy-container, …/deploy-stack
- **REQ-TPL-02 Own app template source.** Point Portainer at a JSON template list (format documented). Entry: CLI `--templates`; UI `#!/settings` (App Templates). docs: advanced/app-templates, advanced/app-templates/build, advanced/app-templates/format, admin/settings/general
- **REQ-TPL-03 Custom templates.** Create custom stack templates from the web editor, an upload or Git, edit and delete them, and deploy them. Entry: UI `#!/{envId}/docker/templates/custom`, `…/custom/new`, `…/custom/{id}`; API `/custom_templates`, `POST /custom_templates/create/{string|file|repository}`, `PUT /custom_templates/{id}/git_fetch`. docs: user/docker/templates/custom
- **REQ-TPL-04 Template variables.** Variables in custom templates that the user fills at deploy time. **BE-only.** docs: user/docker/templates/custom (Variables in templates)

## GIT – App Delivery

- **REQ-GIT-01 Workflows view.** Single view of all Docker, Edge and Kubernetes workloads deployed from Git, with status counts, filters and links to the stack or application. Entry: UI `#!/gitops/workflows`, `#!/gitops/workflows/{id}`; API `GET /gitops/workflows`, `GET /gitops/workflows/{id}`, `GET /gitops/workflows/summary`. docs: user/app-delivery/workflows, …/add-a-new-workflow, …/manage-a-workflow
- **REQ-GIT-02 Git sources.** Central list of Git repositories with credentials and connectivity status; add, test, edit, restrict access and delete. Entry: UI `#!/gitops/sources`, `…/new`, `…/{sourceId}`; API `/gitops/sources`, `POST /gitops/sources/git`, `POST /gitops/sources/test`, `PUT /gitops/sources/{id}/access`. docs: user/app-delivery/sources, user/app-delivery/sources/git
- **REQ-GIT-03 Preview a file from a repository.** Entry: API `POST /gitops/repo/file/preview` (inferred from code).

## REG – Registries

- **REQ-REG-01 Manage registries.** Add, edit and remove registries: Docker Hub account, AWS ECR, Quay.io, ProGet, Azure, GitLab, custom; GitHub (ghcr) is BE-only; OCI registries are BE-only. Entry: UI `#!/registries`, `#!/registries/new`, `#!/registries/{id}`; API `/registries`, `POST /registries/{id}/configure`, `POST /registries/ping`. docs: admin/registries, admin/registries/add and sub-pages
- **REQ-REG-02 Hide anonymous Docker Hub.** **BE-only** (CE flag `HIDE_DOCKER_HUB_ANONYMOUS`, inferred from code). docs: admin/registries
- **REQ-REG-03 Registry access per environment.** Grant users/teams access to a registry in an environment. Entry: UI `#!/{envId}/docker/host/registries`, `#!/{envId}/docker/swarm/registries`, `#!/{envId}/kubernetes/registries`, `…/{id}/access`; API `GET /endpoints/{id}/registries`, `PUT /endpoints/{id}/registries/{registryId}`. docs: user/docker/host/registries, user/docker/swarm/registries, user/kubernetes/cluster/registries
- **REQ-REG-04 Browse and manage registry content.** Browse repositories, add, retag and remove tags. **BE-only.** docs: admin/registries/browse, admin/registries/manage
- **REQ-REG-05 Docker Hub pull-limit check.** Show remaining Docker Hub pulls. Entry: API `GET /endpoints/{id}/dockerhub/{registryId}`; CLI `--pull-limit-check-disabled` (inferred from code).

## K8S – Kubernetes

- **REQ-K8S-01 Kubernetes dashboard.** Environment info and summary tiles. Entry: UI `#!/{envId}/kubernetes/dashboard`; API `GET /kubernetes/{id}/dashboard`. docs: user/kubernetes/dashboard
- **REQ-K8S-02 kubectl shell in the browser.** Entry: UI `#!/{envId}/kubernetes/kubectl-shell`; API `GET /websocket/kubernetes-shell`. docs: user/kubernetes/dashboard/kubectl
- **REQ-K8S-03 Download kubeconfig.** Entry: API `GET /kubernetes/config`. docs: user/kubernetes/dashboard/kubeconfig
- **REQ-K8S-04 Kubernetes custom templates.** Add, edit and remove manifest templates (variables BE-only). Entry: UI `#!/{envId}/kubernetes/templates/custom`. docs: user/kubernetes/templates and sub-pages
- **REQ-K8S-05 Namespaces.** List, add, manage (resource quota, load balancers, networking, registries, storage), set access and remove namespaces. Entry: UI `#!/{envId}/kubernetes/namespaces`, `…/new`, `…/{id}`, `…/{id}/access`; API `/kubernetes/{id}/namespaces`. docs: user/kubernetes/namespaces and sub-pages
- **REQ-K8S-06 Applications from a form.** Deploy an application with the form (image, replicas, env, config, volumes, ports, resources, placement, auto-scaling). Entry: UI `#!/{envId}/kubernetes/applications/new`. docs: user/kubernetes/applications/add
- **REQ-K8S-07 Applications from code.** Deploy manifests from Git, web editor, URL or custom template. Entry: UI `#!/{envId}/kubernetes/deploy`; API `POST /stacks/create/kubernetes/{repository|string|url}`, `POST /kubernetes/{id}/manifests/dry_run`. docs: user/kubernetes/applications/manifest/create
- **REQ-K8S-08 Helm charts.** Install from a Helm repository; inspect revisions, upgrade, roll back and uninstall releases; installing from Git is BE-only. Entry: UI `#!/{envId}/kubernetes/helm`, `#!/{envId}/kubernetes/helm/{namespace}/{name}`; API `/endpoints/{id}/kubernetes/helm`, `GET /templates/helm`. docs: user/kubernetes/applications/manifest/helm, …/inspect-helm, …/edit-helm
- **REQ-K8S-09 Inspect and edit applications.** Application, placement, events and YAML tabs; pods with logs, stats and console; edit, redeploy, roll back; YAML editing, scaling and rolling restart are BE-only. Entry: UI `#!/{envId}/kubernetes/applications/{namespace}/{name}`, `…/edit`, `…/{pod}/{container}/logs|stats|console`; API `GET /websocket/pod`. docs: user/kubernetes/applications/inspect, user/kubernetes/applications/edit
- **REQ-K8S-10 Application webhooks.** **BE-only.** docs: user/kubernetes/applications/webhooks
- **REQ-K8S-11 Detach a volume and remove applications.** docs: user/kubernetes/applications/detach-volume, user/kubernetes/applications/remove
- **REQ-K8S-12 Services and ingresses.** List services; add ingresses by form or manifest; remove ingresses. Entry: UI `#!/{envId}/kubernetes/services`, `#!/{envId}/kubernetes/ingresses`, `…/add`. docs: user/kubernetes/networking/services, user/kubernetes/networking/ingresses and sub-pages
- **REQ-K8S-13 ConfigMaps and Secrets.** List, add, edit and remove. Entry: UI `#!/{envId}/kubernetes/configurations`, `…/configmaps/new`, `…/secrets/new`. docs: user/kubernetes/configurations and sub-pages
- **REQ-K8S-14 Volumes and storage.** Persistent volume claims, persistent volumes and storage classes: inspect, edit (YAML, describe) and remove. Entry: UI `#!/{envId}/kubernetes/volumes`. docs: user/kubernetes/volumes, …/inspect, …/remove
- **REQ-K8S-15 GPU.** **BE-only.** docs: user/kubernetes/gpu
- **REQ-K8S-16 More resources.** Cron jobs and jobs, service accounts, cluster roles/bindings, roles/bindings; custom resources (BE-only for admins). Entry: UI `#!/{envId}/kubernetes/moreResources/…`. docs: user/kubernetes/more-resources and sub-pages
- **REQ-K8S-17 Cluster details and nodes.** Node list, node details (events, YAML, applications; YAML editing BE-only), drain. Entry: UI `#!/{envId}/kubernetes/cluster`, `…/cluster/{nodeName}`; API `POST /kubernetes/{id}/nodes/{name}/drain`. docs: user/kubernetes/cluster/details, user/kubernetes/cluster/details/node
- **REQ-K8S-18 Cluster setup.** Load balancers, ingress controllers, change window, deployment options, security, metrics and storage options. Entry: UI `#!/{envId}/kubernetes/cluster/configure`. docs: user/kubernetes/cluster/setup
- **REQ-K8S-19 Security constraints.** Pod security constraints for the cluster. **BE-only** (CE flag `POD_SECURITY_POLICY_CONSTRAINT`, inferred from code). Entry: UI `#!/{envId}/kubernetes/cluster/securityConstraint`. docs: user/kubernetes/cluster/security
- **REQ-K8S-20 Kubernetes global settings.** Helm repository URL, kubeconfig expiry, KubeShell image, deployment options (enforce code-based deployment etc.). Entry: UI `#!/settings`. docs: admin/settings/general (Kubernetes settings)
- **REQ-K8S-21 Add-ons.** Install and manage Helm-based add-ons on the local Kubernetes cluster. **BE-only.** docs: admin/add-ons and sub-pages

## ACI – Azure Container Instances

- **REQ-ACI-01 Add an ACI environment.** Experimental. docs: admin/environments/add/aci
- **REQ-ACI-02 ACI dashboard and container instances.** List, add, view and remove container instances. Entry: UI `#!/{envId}/azure/dashboard`, `#!/{envId}/azure/containerinstances`, `…/new`, `…/{id}`; API proxy `/endpoints/{id}/azure`. docs: user/aci and sub-pages

## EDGE – Edge Compute

- **REQ-EDGE-01 Enable Edge Compute and its settings.** Toggle Edge features, API server URL and tunnel address, deployment sync options, Edge access. Entry: UI `#!/settings/edge`; CLI `--edge-compute`, `--edge-portainer-url`, `--edge-trust-on-first-connect`, `--tunnel-addr`, `--tunnel-port`. docs: admin/settings/edge, start/install-ce/server/setup (Set up Edge Compute)
- **REQ-EDGE-02 Edge Agent environments.** Connect Docker, Swarm, Podman and Kubernetes hosts via the Edge Agent in standard (tunnel) mode; async mode is BE-only. Entry: UI `#!/wizard/endpoints/create`; API `GET /endpoints/{id}/edge/status`, `POST /endpoints/global-key`. docs: advanced/edge-agent, admin/environments/add/*/edge, admin/environments/add/*/edge-async
- **REQ-EDGE-03 Auto onboarding script.** Generate a script that onboards many Edge Agents. Entry: UI `#!/endpoints/aeec`. docs: admin/environments/aeec
- **REQ-EDGE-04 Prestage an Edge Agent.** docs: advanced/how-to-prestage-an-edge-agent-environment
- **REQ-EDGE-05 Edge groups.** Static and dynamic (tag-based) groups of Edge environments. Entry: UI `#!/edge/groups`, `…/new`, `…/{groupId}`; API `/edge_groups`. docs: user/edge/groups
- **REQ-EDGE-06 Edge stacks.** Deploy Compose, Kubernetes manifests or Helm charts to Edge groups, with per-environment status. Entry: UI `#!/edge/stacks`, `…/new`, `…/{stackId}`; API `/edge_stacks`, `POST /edge_stacks/create/{string|file|repository}`. docs: user/edge/stacks and sub-pages
- **REQ-EDGE-07 Edge jobs.** Run scheduled or one-off scripts on Edge hosts and collect logs. Entry: UI `#!/edge/jobs`, `…/new`, `…/{id}`; API `/edge_jobs`. docs: user/edge/jobs
- **REQ-EDGE-08 Edge templates.** Application and custom templates for Edge stacks. Entry: UI `#!/edge/templates`, `#!/edge/templates/custom`. docs: user/edge/templates and sub-pages
- **REQ-EDGE-09 Edge configurations.** **BE-only.** docs: user/edge/configurations
- **REQ-EDGE-10 Waiting room.** Approve new Edge devices before they are trusted. **BE-only** (CE route `#!/edge/devices/waiting-room` exists, inferred from code). docs: user/edge/waiting-room
- **REQ-EDGE-11 Snapshot browsing of async devices.** **BE-only** (depends on async mode). docs: user/home/snapshot

## SET – Global settings

- **REQ-SET-01 General application settings.** Snapshot interval, Edge agent default poll frequency, custom logo, App Templates URL. Entry: UI `#!/settings`; API `GET/PUT /settings`, `GET /settings/public`; CLI `--logo`, `--templates`, `--snapshot-interval`. docs: admin/settings/general
- **REQ-SET-02 Hidden containers.** Hide containers by label from the UI. Entry: UI `#!/settings`; CLI `--hide-label`. docs: admin/settings/general (Hidden containers), advanced/cli
- **REQ-SET-03 SSRF protection.** Control which destinations Portainer may proxy requests to. Entry: UI `#!/settings`. docs: admin/settings/general (SSRF)
- **REQ-SET-04 SSL settings.** Force HTTPS only, secure cookies, upload a new certificate. Entry: UI `#!/settings`; API `GET/PUT /ssl`, `POST /upload/tls/{certificate}`. docs: admin/settings/general (SSL certificate)
- **REQ-SET-05 Automatic patch updates, experimental features, CA file for Helm repositories, add-on settings.** **BE-only.** docs: admin/settings/general
- **REQ-SET-06 Shared credentials (Omni, SSH, Git).** **BE-only.** docs: admin/settings/credentials and sub-pages
- **REQ-SET-07 Support bundle and debug log.** **BE-only.** docs: admin/settings/general (Portainer support)
- **REQ-SET-08 Message of the day.** Show Portainer news on the home screen. Entry: API `GET /motd` (inferred from code).

## BKP – Backup and restore

- **REQ-BKP-01 Download a backup.** Download the Portainer configuration as an archive, optionally password-protected. Entry: UI `#!/settings` (Back up Portainer); API `POST /backup`. docs: admin/settings/general (Back up Portainer), faqs/getting-started/what-does-portainers-backup-include
- **REQ-BKP-02 Restore from a local file on a fresh instance.** Entry: UI `#!/init/admin` (restore option); API `POST /restore`; setup token required unless `--no-setup-token`. docs: admin/settings/general (Restoring from a local file)
- **REQ-BKP-03 Scheduled backups to local disk, S3 or Azure Blob, and restore from S3.** **BE-only** (CE flags `S3_BACKUP_SETTING`, `S3_RESTORE`, inferred from code). docs: admin/settings/general

## LOG – Logs and notifications

- **REQ-LOG-01 Authentication logs.** **BE-only** (CE route `#!/auth-logs` shows an upsell, inferred from code). docs: admin/logs/authentication
- **REQ-LOG-02 Activity logs.** **BE-only** (CE route `#!/activity-logs`). docs: admin/logs/activity
- **REQ-LOG-03 Stream logs to an external SIEM.** **BE-only.** docs: advanced/siem
- **REQ-LOG-04 Notifications history.** Record of in-app notification messages; search and remove; the 50 most recent behind the bell icon. Entry: UI `#!/notifications`. docs: admin/notifications
- **REQ-LOG-05 Server log level and format.** Entry: CLI `--log-level`, `--log-mode`. docs: advanced/cli

## ALR – Alerting and recommendations

- **REQ-ALR-01 Alerting.** Alert rules for environments and Portainer, silencing, delivery to Slack, Teams, email or webhook. **BE-only.** docs: user/alerting, user/alerting/alerting-rules
- **REQ-ALR-02 Recommendations.** Suggestions about misconfiguration and best practices for admins. **BE-only.** docs: admin/recommendations

## LIC – Licensing and Business Edition

- **REQ-LIC-01 Licenses.** Add, renew and remove BE license keys. **BE-only.** Entry (BE): CLI `--license-key`. docs: admin/licenses
- **REQ-LIC-02 Upgrade to Business Edition from within CE.** An "Upgrade to Business Edition" banner in the sidebar lets an admin paste a license or request a trial and start the in-place upgrade. Entry: UI sidebar banner (`app/react/sidebar/UpgradeBEBanner`); API `POST /system/upgrade`. docs: start/upgrade/tobe/inapp, start/upgrade/tobe
- **REQ-LIC-03 Business Edition feature indicators in CE.** BE-only options are shown in CE as disabled controls or upsell pages that link to the Business Edition offer (for example webhooks, RBAC roles, activity logs, registry browsing, S3 backup). (inferred from code: `app/react/portainer/feature-flags/enums.ts`, BE feature indicators in `app/`)

## API – REST API and automation

- **REQ-API-01 Documented REST API.** All UI functions are available over the Portainer REST API, described by OpenAPI/Swagger. Entry: `api/docs/swagger.yaml`, `api/docs/openapi.yaml`. docs: api/docs, api/examples
- **REQ-API-02 API access with tokens.** Authenticate API calls with a personal access token (`X-API-Key`) or a JWT from `POST /auth`. docs: api/access
- **REQ-API-03 Terraform provider.** Manage Portainer resources with the official Terraform provider (external project). docs: advanced/manage-portainer-using-terraform
- **REQ-API-04 Portainer MCP server.** An MCP server generated from the OpenAPI spec exposes the API to MCP clients (external project). docs: advanced/portainer-mcp-server

## Not covered as requirements

- Release notes, lifecycle policy, FAQs, troubleshooting, and the separate products Portainer-IDP and Portainer-Migrate in llms.txt: product docs, not CE features.
- Deprecated and removed features (for example Nomad): listed upstream on advanced/deprecated; not part of 2.45.3.

## Planned additions (not upstream)

- A maintenance screen to remove unused containers and images quickly is part of the vision. It is a new feature for a later stage and is deliberately not a REQ in this upstream list.
