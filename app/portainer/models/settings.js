export function SettingsViewModel(data) {
  this.LogoURL = data.LogoURL;
  this.BlackListedLabels = data.BlackListedLabels;
  this.SnapshotInterval = data.SnapshotInterval;
  this.TemplatesURL = data.TemplatesURL;
  this.EdgeAgentCheckinInterval = data.EdgeAgentCheckinInterval;
  this.EnableEdgeComputeFeatures = data.EnableEdgeComputeFeatures;
  this.FeatureFlagSettings = data.FeatureFlagSettings;
  this.TrustOnFirstConnect = data.TrustOnFirstConnect;
  this.EnforceEdgeID = data.EnforceEdgeID;
  this.AgentSecret = data.AgentSecret;
  this.EdgePortainerUrl = data.EdgePortainerUrl;
}

export function PublicSettingsViewModel(settings) {
  this.EnableEdgeComputeFeatures = settings.EnableEdgeComputeFeatures;
  this.EnforceEdgeID = settings.EnforceEdgeID;
  this.LogoURL = settings.LogoURL;
  this.Features = settings.Features;
  this.Edge = new EdgeSettingsViewModel(settings.Edge);
  this.DefaultRegistry = settings.DefaultRegistry;
}

export function EdgeSettingsViewModel(data = {}) {
  this.CheckinInterval = data.CheckinInterval;
  this.PingInterval = data.PingInterval;
  this.SnapshotInterval = data.SnapshotInterval;
  this.CommandInterval = data.CommandInterval;
}
