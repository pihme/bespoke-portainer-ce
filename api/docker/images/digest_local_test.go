package images

import (
	"testing"

	"github.com/docker/docker/api/types/image"
	"github.com/opencontainers/go-digest"
	"github.com/stretchr/testify/require"
)

func TestREQ_IMG_06_ParseLocalImage_LocalBuilt(t *testing.T) {
	t.Parallel()

	img, err := ParseLocalImage(image.InspectResponse{
		ID:          "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		RepoTags:    []string{"localbuild:dev"},
		RepoDigests: nil,
	})
	require.Error(t, err)
	require.Nil(t, img)
	require.Contains(t, err.Error(), "not regular")
}

func TestREQ_IMG_06_ParseLocalImage_NoTag(t *testing.T) {
	t.Parallel()

	img, err := ParseLocalImage(image.InspectResponse{
		ID:          "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		RepoTags:    nil,
		RepoDigests: []string{"docker.io/library/nginx@sha256:4bcff63911fcb4448bd4fdacec207030997caf25e9bea4045fa6c8c44de311d1"},
	})
	require.NoError(t, err)
	require.NotNil(t, img)
	require.Equal(t, "library/nginx", img.Path)
	require.Empty(t, img.Tag)
	require.Equal(t, "sha256:4bcff63911fcb4448bd4fdacec207030997caf25e9bea4045fa6c8c44de311d1", img.Digest.String())
}

func TestREQ_IMG_06_ParseRepoDigests(t *testing.T) {
	t.Parallel()

	digests := ParseRepoDigests([]string{
		"docker.io/library/nginx@sha256:4bcff63911fcb4448bd4fdacec207030997caf25e9bea4045fa6c8c44de311d1",
		"not-a-digest",
		"repo@not-a-valid-digest",
		"",
	})
	require.Len(t, digests, 1)
	require.Equal(t, digest.Digest("sha256:4bcff63911fcb4448bd4fdacec207030997caf25e9bea4045fa6c8c44de311d1"), digests[0])
}

func TestREQ_IMG_06_ParseRepoTags(t *testing.T) {
	t.Parallel()

	images := ParseRepoTags([]string{
		"nginx:latest",
		"",
		"@@@",
	})
	require.Len(t, images, 1)
	require.Equal(t, "library/nginx", images[0].Path)
	require.Equal(t, "latest", images[0].Tag)
}

func TestREQ_IMG_06_ParseRepoDigest(t *testing.T) {
	t.Parallel()

	require.Equal(t, digest.Digest(""), ParseRepoDigest("no-at-sign"))
	require.Equal(t, digest.Digest(""), ParseRepoDigest("repo@bad"))
	require.Equal(t,
		digest.Digest("sha256:4bcff63911fcb4448bd4fdacec207030997caf25e9bea4045fa6c8c44de311d1"),
		ParseRepoDigest("myimage@sha256:4bcff63911fcb4448bd4fdacec207030997caf25e9bea4045fa6c8c44de311d1"),
	)
}

func TestREQ_IMG_06_ParseRepoTag(t *testing.T) {
	t.Parallel()

	require.Nil(t, ParseRepoTag(""))
	require.Nil(t, ParseRepoTag("@@@"))

	img := ParseRepoTag("ghcr.io/org/pkg:1.2.3")
	require.NotNil(t, img)
	require.Equal(t, "ghcr.io", img.Domain)
	require.Equal(t, "org/pkg", img.Path)
	require.Equal(t, "1.2.3", img.Tag)
}

func TestNewClientWithRegistry(t *testing.T) {
	t.Parallel()

	c := NewClientWithRegistry(nil, nil)
	require.NotNil(t, c)
	require.Nil(t, c.registryClient)
	require.Nil(t, c.clientFactory)
}

func TestREQ_IMG_06_ParseLocalImage_InvalidDigestReference(t *testing.T) {
	t.Parallel()

	img, err := ParseLocalImage(image.InspectResponse{
		ID:          "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
		RepoTags:    []string{"nginx:latest"},
		RepoDigests: []string{"INVALID@@"},
	})
	require.Error(t, err)
	require.Nil(t, img)
}

func TestREQ_IMG_06_ParseLocalImage_InvalidTagReference(t *testing.T) {
	t.Parallel()

	img, err := ParseLocalImage(image.InspectResponse{
		ID:          "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
		RepoTags:    []string{"INVALID@@"},
		RepoDigests: []string{"docker.io/library/nginx@sha256:4bcff63911fcb4448bd4fdacec207030997caf25e9bea4045fa6c8c44de311d1"},
	})
	require.Error(t, err)
	require.Nil(t, img)
}
