export interface TLSConfiguration {
  TLS: boolean;
  TLSSkipVerify: boolean;
  TLSCACert?: string;
  TLSCert?: string;
  TLSKey?: string;
}

export interface Pair {
  name: string;
  value?: string;
}

type Feature = string;

export interface DefaultRegistry {
  Hide: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ExperimentalFeatures {}

export interface Settings {
  LogoURL: string;
  CustomLoginBanner: string;
  BlackListedLabels: Pair[];
  FeatureFlagSettings: { [key: Feature]: boolean };
  SnapshotInterval: string;
  TemplatesURL: string;
  EnableEdgeComputeFeatures: boolean;
  KubeconfigExpiry: string;
  HelmRepositoryURL: string;
  KubectlShellImage: string;
  TrustOnFirstConnect: boolean;
  EnforceEdgeID: boolean;
  AgentSecret: string;
  EdgePortainerUrl: string;
  EdgeAgentCheckinInterval: number;
  EdgeCommandInterval: number;
  EdgePingInterval: number;
  EdgeSnapshotInterval: number;
  DisplayDonationHeader: boolean;
  DisplayExternalContributors: boolean;
  EnableHostManagementFeatures: boolean;
  ExperimentalFeatures?: ExperimentalFeatures;
  AllowVolumeBrowserForRegularUsers: boolean;
  AllowBindMountsForRegularUsers: boolean;
  AllowPrivilegedModeForRegularUsers: boolean;
  AllowHostNamespaceForRegularUsers: boolean;
  AllowStackManagementForRegularUsers: boolean;
  AllowDeviceMappingForRegularUsers: boolean;
  AllowContainerCapabilitiesForRegularUsers: boolean;
  ForceSecureCookies: boolean;
  GlobalDeploymentOptions?: GlobalDeploymentOptions;
  Edge: {
    PingInterval: number;
    SnapshotInterval: number;
    CommandInterval: number;
    AsyncMode: boolean;
    TunnelServerAddress: string;
  };
}

export interface GlobalDeploymentOptions {
  /** Hide manual deploy forms in portainer */
  hideAddWithForm: boolean;
  /** Configure this per environment or globally */
  perEnvOverride: boolean;
  /** Hide the web editor in the remaining visible forms */
  hideWebEditor: boolean;
  /** Hide the file upload option in the remaining visible forms */
  hideFileUpload: boolean;
  /** Make note on application add/edit screen required */
  requireNoteOnApplications: boolean;
  minApplicationNoteLength: number;

  hideStacksFunctionality: boolean;
}

export interface PublicSettingsResponse {
  /** URL to a logo that will be displayed on the login page as well as on top of the sidebar. Will use default Portainer logo when value is empty string  */
  LogoURL: string;
  /** The content in plaintext used to display in the login page. Will hide when value is empty string (only on BE) */
  CustomLoginBanner: string;
  /** Deployment options for encouraging deployment as code (only on BE) */
  GlobalDeploymentOptions: GlobalDeploymentOptions;
  /** Whether edge compute features are enabled */
  EnableEdgeComputeFeatures: boolean;
  /** Supported feature flags */
  Features: { [key: Feature]: boolean };
  /** The expiry of a Kubeconfig */
  KubeconfigExpiry: string;
  /** Whether to hide default registry (only on BE) */
  DefaultRegistry?: {
    Hide: boolean;
  };
  Edge: {
    /** Whether the device has been started in edge async mode */
    AsyncMode: boolean;
    /** The ping interval for edge agent - used in edge async mode [seconds] */
    PingInterval: number;
    /** The snapshot interval for edge agent - used in edge async mode [seconds] */
    SnapshotInterval: number;
    /** The command list interval for edge agent - used in edge async mode [seconds] */
    CommandInterval: number;
    /** The check in interval for edge agent (in seconds) - used in non async mode [seconds] */
    CheckinInterval: number;
  };
}
