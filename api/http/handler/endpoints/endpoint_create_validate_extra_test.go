package endpoints

import (
	"net/http"
	"net/url"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/pkg/fips"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func formRequest(values map[string][]string) *http.Request {
	return &http.Request{Form: values, PostForm: values, Method: http.MethodPost, URL: &url.URL{Path: "/endpoints"}}
}

func TestREQ_ENV_11_Validate_LocalDocker_AcceptsPublicURLAndGpus(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	p := &endpointCreatePayload{}
	err := p.Validate(formRequest(map[string][]string{
		"Name":                 {"local"},
		"EndpointCreationType": {"1"},
		"URL":                  {"unix:///var/run/docker.sock"},
		"PublicURL":            {"docker.example.com"},
		"ContainerEngine":      {"docker"},
		"TagIds":               {"[1,2]"},
		"Gpus":                 {`[{"name":"gpu0","value":"nvidia.com/gpu=0"}]`},
		"GroupID":              {"1"},
	}))
	require.NoError(t, err)
	assert.Equal(t, "docker.example.com", p.PublicURL)
	assert.Equal(t, []portainer.Pair{{Name: "gpu0", Value: "nvidia.com/gpu=0"}}, p.Gpus)
	assert.Equal(t, localDockerEnvironment, p.EndpointCreationType)
}

func TestREQ_ENV_11_Validate_InvalidContainerEngine_ReturnsError(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	p := &endpointCreatePayload{}
	err := p.Validate(formRequest(map[string][]string{
		"Name":                 {"local"},
		"EndpointCreationType": {"1"},
		"ContainerEngine":      {"podman-typo"},
	}))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "container engine")
}

func TestREQ_ENV_11_Validate_InvalidCreationType_ReturnsError(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	p := &endpointCreatePayload{}
	err := p.Validate(formRequest(map[string][]string{
		"Name":                 {"local"},
		"EndpointCreationType": {"0"},
	}))
	require.Error(t, err)
}

// REQ-TAI-013: environment groups and tags are removed; the GroupID and
// TagIds form values are no longer read, even when malformed.
func TestREQ_TAI_013_Validate_IgnoresGroupAndTagIds(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	p := &endpointCreatePayload{}
	err := p.Validate(formRequest(map[string][]string{
		"Name":                 {"local"},
		"EndpointCreationType": {"1"},
		"GroupID":              {"not-a-number"},
		"TagIds":               {"not-json"},
	}))
	require.NoError(t, err)
}

func TestREQ_ENV_11_Validate_InvalidGpusJSON_ReturnsError(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	p := &endpointCreatePayload{}
	err := p.Validate(formRequest(map[string][]string{
		"Name":                 {"local"},
		"EndpointCreationType": {"1"},
		"Gpus":                 {"not-json"},
	}))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "Gpus")
}

func TestREQ_ENV_11_Validate_PodmanEngine_OK(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	p := &endpointCreatePayload{}
	err := p.Validate(formRequest(map[string][]string{
		"Name":                 {"podman-local"},
		"EndpointCreationType": {"1"},
		"ContainerEngine":      {"podman"},
	}))
	require.NoError(t, err)
	assert.Equal(t, portainer.ContainerEnginePodman, p.ContainerEngine)
}

// REQ-TAI-013: tags are removed; saving an environment stores it and no
// longer writes tag records.
func TestREQ_TAI_013_SaveEndpoint_DoesNotTouchTags(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	tag := &portainer.Tag{Name: "env-tag", Endpoints: map[portainer.EndpointID]bool{}, EndpointGroups: map[portainer.EndpointGroupID]bool{}}
	require.NoError(t, store.TagService.Create(tag))

	h := &Handler{DataStore: store}
	ep := &portainer.Endpoint{
		ID:      portainer.EndpointID(store.Endpoint().GetNextIdentifier()),
		Name:    "tagged-env",
		Type:    portainer.DockerEnvironment,
		GroupID: 1,
		TagIDs:  []portainer.TagID{tag.ID},
	}
	require.NoError(t, h.saveEndpointAndUpdateAuthorizations(store, ep))

	saved, err := store.Endpoint().Endpoint(ep.ID)
	require.NoError(t, err)
	assert.Equal(t, "tagged-env", saved.Name)

	updated, err := store.TagService.Read(tag.ID)
	require.NoError(t, err)
	assert.False(t, updated.Endpoints[ep.ID])
}

// REQ-TAI-002: the local Kubernetes environment (creation type 5) is removed
// with Kubernetes; the payload is rejected.
func TestREQ_TAI_002_Validate_LocalKubernetesCreationType_ReturnsError(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	p := &endpointCreatePayload{}
	err := p.Validate(formRequest(map[string][]string{
		"Name":                 {"k8s"},
		"EndpointCreationType": {"5"},
	}))
	require.Error(t, err)
	require.NotContains(t, err.Error(), "Kubernetes")
}

// REQ-TAI-004: the Edge Agent environment (creation type 4) is removed with
// Edge; the payload is rejected, with or without TLS.
func TestREQ_TAI_004_Validate_EdgeAgentCreationType_ReturnsError(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)

	for _, form := range []map[string][]string{
		{"Name": {"edge"}, "EndpointCreationType": {"4"}, "URL": {"https://portainer.example:9443"}},
		{"Name": {"edge"}, "EndpointCreationType": {"4"}, "TLS": {"true"}},
	} {
		p := &endpointCreatePayload{}
		err := p.Validate(formRequest(form))
		require.EqualError(t, err, "Edge Agent environments are no longer supported")
	}
}
