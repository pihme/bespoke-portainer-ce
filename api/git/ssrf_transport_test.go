package git

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/pkg/libhttp/ssrf"

	gittransport "github.com/go-git/go-git/v5/plumbing/transport"
	"github.com/stretchr/testify/require"
)

type staticSSRFService struct {
	parsed portainer.ParsedAllowList
}

func (s *staticSSRFService) ReadParsed(portainer.AllowListKey) (*portainer.ParsedAllowList, error) {
	return &s.parsed, nil
}

type recordingGitTransport struct {
	uploadCalled  int
	receiveCalled int
	uploadErr     error
	receiveErr    error
}

func (r *recordingGitTransport) NewUploadPackSession(*gittransport.Endpoint, gittransport.AuthMethod) (gittransport.UploadPackSession, error) {
	r.uploadCalled++
	return nil, r.uploadErr
}

func (r *recordingGitTransport) NewReceivePackSession(*gittransport.Endpoint, gittransport.AuthMethod) (gittransport.ReceivePackSession, error) {
	r.receiveCalled++
	return nil, r.receiveErr
}

func TestREQ_SET_03_SSRFGitTransport_AllowsWhenPolicyOff(t *testing.T) {
	parsed := ssrf.ParseAllowedHosts(nil)
	parsed.Mode = portainer.SSRFModeOff
	require.NoError(t, ssrf.Configure(&staticSSRFService{parsed: parsed}))
	t.Cleanup(func() {
		off := ssrf.ParseAllowedHosts(nil)
		off.Mode = portainer.SSRFModeOff
		_ = ssrf.Configure(&staticSSRFService{parsed: off})
	})

	inner := &recordingGitTransport{}
	tr := NewSSRFGitTransport(inner).(*ssrfGitTransport)

	ep, err := gittransport.NewEndpoint("git://127.0.0.1/repo.git")
	require.NoError(t, err)

	_, err = tr.NewUploadPackSession(ep, nil)
	require.NoError(t, err)
	require.Equal(t, 1, inner.uploadCalled)

	_, err = tr.NewReceivePackSession(ep, nil)
	require.NoError(t, err)
	require.Equal(t, 1, inner.receiveCalled)
}

func TestREQ_SET_03_SSRFGitTransport_BlocksPrivateHostWhenEnforced(t *testing.T) {
	parsed := ssrf.ParseAllowedHosts([]string{"allowed.example"})
	parsed.Mode = portainer.SSRFModeEnforce
	require.NoError(t, ssrf.Configure(&staticSSRFService{parsed: parsed}))
	t.Cleanup(func() {
		off := ssrf.ParseAllowedHosts(nil)
		off.Mode = portainer.SSRFModeOff
		_ = ssrf.Configure(&staticSSRFService{parsed: off})
	})

	inner := &recordingGitTransport{}
	tr := NewSSRFGitTransport(inner).(*ssrfGitTransport)

	ep, err := gittransport.NewEndpoint("git://127.0.0.1/repo.git")
	require.NoError(t, err)

	_, err = tr.NewUploadPackSession(ep, nil)
	require.Error(t, err)
	require.Equal(t, 0, inner.uploadCalled)

	_, err = tr.NewReceivePackSession(ep, nil)
	require.Error(t, err)
	require.Equal(t, 0, inner.receiveCalled)
}

func TestREQ_SET_03_checkEndpointSSRF_UsesDefaultGitPort(t *testing.T) {
	parsed := ssrf.ParseAllowedHosts([]string{"8.8.8.8"})
	parsed.Mode = portainer.SSRFModeEnforce
	require.NoError(t, ssrf.Configure(&staticSSRFService{parsed: parsed}))
	t.Cleanup(func() {
		off := ssrf.ParseAllowedHosts(nil)
		off.Mode = portainer.SSRFModeOff
		_ = ssrf.Configure(&staticSSRFService{parsed: off})
	})

	ep := &gittransport.Endpoint{Host: "127.0.0.1", Port: 0}
	err := checkEndpointSSRF(ep)
	require.Error(t, err)
}
