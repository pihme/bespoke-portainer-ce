package images

import (
	"testing"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/image"
	"github.com/stretchr/testify/require"
)

func TestREQ_IMG_02_ParseImage_HubLinks(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		image   string
		hubLink string
	}{
		{
			name:    "docker hub library",
			image:   "nginx",
			hubLink: "https://hub.docker.com/_/nginx",
		},
		{
			name:    "bintray",
			image:   "docker.bintray.io/jfrog/artifactory-pro:latest",
			hubLink: "https://bintray.com/jfrog/reg2/jfrog%3Aartifactory-pro",
		},
		{
			name:    "github packages",
			image:   "docker.pkg.github.com/owner/repo/image:latest",
			hubLink: "https://github.com/owner/repo/packages",
		},
		{
			name:    "ghcr",
			image:   "ghcr.io/owner/package:latest",
			hubLink: "https://github.com/users/owner/packages/container/package/package",
		},
		{
			name:    "quay",
			image:   "quay.io/prometheus/node-exporter:latest",
			hubLink: "https://quay.io/repository/prometheus/node-exporter",
		},
		{
			name:    "redhat",
			image:   "registry.access.redhat.com/ubi8/ubi:latest",
			hubLink: "https://access.redhat.com/containers/#/registry.access.redhat.com/ubi8/ubi",
		},
		{
			name:    "gitlab",
			image:   "registry.gitlab.com/group/project:latest",
			hubLink: "https://gitlab.com/group/project/container_registry",
		},
		{
			name:    "unknown registry has empty hub link",
			image:   "example.local/team/app:1.0",
			hubLink: "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			img, err := ParseImage(ParseImageOptions{Name: tc.image})
			require.NoError(t, err)
			require.Equal(t, tc.hubLink, img.HubLink)
		})
	}
}

func TestREQ_IMG_02_ParseImage_HubTemplate(t *testing.T) {
	t.Parallel()

	img, err := ParseImage(ParseImageOptions{
		Name:   "example.local/team/app:1.0",
		HubTpl: "https://hub.example/{{.Path}}",
	})
	require.NoError(t, err)
	require.Equal(t, "https://hub.example/team/app", img.HubLink)
}

func TestREQ_IMG_02_ParseImage_HubTemplateError(t *testing.T) {
	t.Parallel()

	_, err := ParseImage(ParseImageOptions{
		Name:   "example.local/team/app:1.0",
		HubTpl: "{{.MissingField}}",
	})
	require.Error(t, err)

	_, err = ParseImage(ParseImageOptions{
		Name:   "example.local/team/app:1.0",
		HubTpl: "{{",
	})
	require.Error(t, err)
}

func TestREQ_IMG_02_ParseImage_InvalidName(t *testing.T) {
	t.Parallel()

	_, err := ParseImage(ParseImageOptions{Name: "INVALID@@"})
	require.Error(t, err)
}

func TestREQ_IMG_06_IsLocalDanglingNoTagImage(t *testing.T) {
	t.Parallel()

	require.True(t, IsLocalImage(types.ImageInspect{RepoDigests: nil}))
	require.False(t, IsLocalImage(types.ImageInspect{RepoDigests: []string{"repo@sha256:4bcff63911fcb4448bd4fdacec207030997caf25e9bea4045fa6c8c44de311d1"}}))

	require.True(t, IsDanglingImage(image.InspectResponse{
		RepoTags:    []string{"<none>:<none>"},
		RepoDigests: []string{"<none>@<none>"},
	}))
	require.False(t, IsDanglingImage(image.InspectResponse{
		RepoTags:    []string{"nginx:latest"},
		RepoDigests: []string{"nginx@sha256:4bcff63911fcb4448bd4fdacec207030997caf25e9bea4045fa6c8c44de311d1"},
	}))

	require.True(t, IsNoTagImage(image.InspectResponse{RepoTags: nil}))
	require.False(t, IsNoTagImage(image.InspectResponse{RepoTags: []string{"nginx:latest"}}))
}
