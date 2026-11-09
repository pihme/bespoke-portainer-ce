package git

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	githttp "github.com/go-git/go-git/v5/plumbing/transport/http"
	gittypes "github.com/portainer/portainer/api/git/types"
	"github.com/portainer/portainer/pkg/fips"

	"github.com/stretchr/testify/require"
)

func Test_formatReferenceName_And_getVersionType(t *testing.T) {
	t.Parallel()

	require.Equal(t, "main", formatReferenceName("refs/heads/main"))
	require.Equal(t, "v1.0", formatReferenceName("refs/tags/v1.0"))
	require.Equal(t, "abc123", formatReferenceName("abc123"))

	require.Equal(t, "branch", getVersionType("refs/heads/main"))
	require.Equal(t, "tag", getVersionType("refs/tags/v1.0"))
	require.Equal(t, "commit", getVersionType("deadbeef"))
}

func Test_checkAzureStatusCode(t *testing.T) {
	t.Parallel()

	base := http.ErrNotSupported
	require.ErrorIs(t, checkAzureStatusCode(base, http.StatusNotFound), gittypes.ErrIncorrectRepositoryURL)
	require.ErrorIs(t, checkAzureStatusCode(base, http.StatusUnauthorized), gittypes.ErrAuthenticationFailure)
	require.ErrorIs(t, checkAzureStatusCode(base, http.StatusNonAuthoritativeInfo), gittypes.ErrAuthenticationFailure)
	require.Equal(t, base, checkAzureStatusCode(base, http.StatusBadGateway))
}

func TestREQ_STK_03_AzureListRefs_WithMockServer(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)

	t.Run("success lists refs and skips HEAD", func(t *testing.T) {
		t.Parallel()
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, _, ok := r.BasicAuth()
			require.True(t, ok)
			require.Equal(t, "alice", user)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"value": []azureRef{
					{Name: "HEAD", ObjectID: "000"},
					{Name: "refs/heads/main", ObjectID: "aaa"},
					{Name: "refs/heads/develop", ObjectID: "bbb"},
				},
			})
		}))
		t.Cleanup(server.Close)

		client := &azureClient{baseUrl: server.URL}
		refs, err := client.ListRefs(t.Context(), "https://dev.azure.com/Organisation/Project/_git/Repository", &git.ListOptions{
			Auth: &githttp.BasicAuth{Username: "alice", Password: "token"},
		})
		require.NoError(t, err)
		require.Equal(t, []string{"refs/heads/main", "refs/heads/develop"}, refs)
	})

	t.Run("nil options rejected", func(t *testing.T) {
		t.Parallel()
		client := &azureClient{baseUrl: "http://example.invalid"}
		_, err := client.ListRefs(t.Context(), "https://dev.azure.com/Organisation/Project/_git/Repository", nil)
		require.EqualError(t, err, "options cannot be nil")
	})

	t.Run("unauthorized maps to auth failure", func(t *testing.T) {
		t.Parallel()
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusUnauthorized)
		}))
		t.Cleanup(server.Close)

		client := &azureClient{baseUrl: server.URL}
		_, err := client.ListRefs(t.Context(), "https://dev.azure.com/Organisation/Project/_git/Repository", &git.ListOptions{})
		require.ErrorIs(t, err, gittypes.ErrAuthenticationFailure)
	})

	t.Run("not found maps to incorrect URL", func(t *testing.T) {
		t.Parallel()
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusNotFound)
		}))
		t.Cleanup(server.Close)

		client := &azureClient{baseUrl: server.URL}
		_, err := client.ListRefs(t.Context(), "https://dev.azure.com/Organisation/Project/_git/Repository", &git.ListOptions{})
		require.ErrorIs(t, err, gittypes.ErrIncorrectRepositoryURL)
	})

	t.Run("non-basic auth rejected", func(t *testing.T) {
		t.Parallel()
		client := &azureClient{baseUrl: "http://example.invalid"}
		_, err := client.ListRefs(t.Context(), "https://dev.azure.com/Organisation/Project/_git/Repository", &git.ListOptions{
			Auth: bogusAuth{},
		})
		require.EqualError(t, err, "only basic auth is supported for azure")
	})

	t.Run("url credentials used when auth nil", func(t *testing.T) {
		t.Parallel()
		var gotUser, gotPass string
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			gotUser, gotPass, _ = r.BasicAuth()
			_ = json.NewEncoder(w).Encode(map[string]any{"value": []azureRef{}})
		}))
		t.Cleanup(server.Close)

		client := &azureClient{baseUrl: server.URL}
		_, err := client.ListRefs(t.Context(), "https://user:pass@dev.azure.com/Organisation/Project/_git/Repository", &git.ListOptions{})
		require.NoError(t, err)
		require.Equal(t, "user", gotUser)
		require.Equal(t, "pass", gotPass)
	})

	t.Run("invalid json returns error", func(t *testing.T) {
		t.Parallel()
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte("{not-json"))
		}))
		t.Cleanup(server.Close)

		client := &azureClient{baseUrl: server.URL}
		_, err := client.ListRefs(t.Context(), "https://dev.azure.com/Organisation/Project/_git/Repository", &git.ListOptions{})
		require.Error(t, err)
		require.ErrorContains(t, err, "could not parse Azure refs response")
	})
}

func TestREQ_STK_03_AzureListFiles_WithMockServer(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)

	rootPayload := `{
	  "count": 1,
	  "value": [{
	    "objectId": "tree-oid",
	    "gitObjectType": "tree",
	    "commitId": "commit-oid",
	    "path": "/",
	    "isFolder": true
	  }]
	}`
	treePayload := `{
	  "treeEntries": [
	    {"relativePath": "docker-compose.yml", "mode": "100644"},
	    {"relativePath": "subdir", "mode": "040000"},
	    {"relativePath": "README.md", "mode": "100644"}
	  ]
	}`

	handler := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if strings.Contains(r.URL.Path, "/trees/") {
			_, _ = w.Write([]byte(treePayload))
			return
		}
		_, _ = w.Write([]byte(rootPayload))
	}

	t.Run("lists files excluding directories", func(t *testing.T) {
		t.Parallel()
		server := httptest.NewServer(http.HandlerFunc(handler))
		t.Cleanup(server.Close)

		client := &azureClient{baseUrl: server.URL}
		files, err := client.ListFiles(t.Context(), false, &git.CloneOptions{
			URL:           "https://dev.azure.com/Organisation/Project/_git/Repository",
			ReferenceName: plumbing.ReferenceName("refs/heads/main"),
			Auth:          &githttp.BasicAuth{Username: "u", Password: "p"},
		})
		require.NoError(t, err)
		require.Equal(t, []string{"docker-compose.yml", "README.md"}, files)
	})

	t.Run("dirOnly returns directories", func(t *testing.T) {
		t.Parallel()
		server := httptest.NewServer(http.HandlerFunc(handler))
		t.Cleanup(server.Close)

		client := &azureClient{baseUrl: server.URL}
		dirs, err := client.ListFiles(t.Context(), true, &git.CloneOptions{
			URL: "https://dev.azure.com/Organisation/Project/_git/Repository",
		})
		require.NoError(t, err)
		require.Equal(t, []string{"subdir"}, dirs)
	})

	t.Run("nil options rejected", func(t *testing.T) {
		t.Parallel()
		client := &azureClient{baseUrl: "http://example.invalid"}
		_, err := client.ListFiles(t.Context(), false, nil)
		require.EqualError(t, err, "options cannot be nil")
	})

	t.Run("tree status error propagated", func(t *testing.T) {
		t.Parallel()
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.Contains(r.URL.Path, "/trees/") {
				w.WriteHeader(http.StatusBadGateway)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(rootPayload))
		}))
		t.Cleanup(server.Close)

		client := &azureClient{baseUrl: server.URL}
		_, err := client.ListFiles(t.Context(), false, &git.CloneOptions{
			URL: "https://dev.azure.com/Organisation/Project/_git/Repository",
		})
		require.Error(t, err)
		require.ErrorContains(t, err, "failed to list tree url")
	})
}

func TestREQ_STK_03_AzureDownload_UnzipsComposeFile(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)

	zipBytes, err := os.ReadFile("./testdata/azure-repo.zip")
	require.NoError(t, err)

	t.Run("download and unzip", func(t *testing.T) {
		t.Parallel()
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, pass, ok := r.BasicAuth()
			require.True(t, ok)
			require.Equal(t, "alice", user)
			require.Equal(t, "token", pass)
			w.Header().Set("Content-Type", "application/zip")
			_, _ = w.Write(zipBytes)
		}))
		t.Cleanup(server.Close)

		client := &azureClient{baseUrl: server.URL}
		dst := t.TempDir()
		err := client.Download(t.Context(), dst, &git.CloneOptions{
			URL:             "https://dev.azure.com/Organisation/Project/_git/Repository",
			ReferenceName:   plumbing.ReferenceName("refs/heads/main"),
			Auth:            &githttp.BasicAuth{Username: "alice", Password: "token"},
			InsecureSkipTLS: true,
		})
		require.NoError(t, err)
		require.FileExists(t, filepath.Join(dst, "docker-compose.yml"))
	})

	t.Run("nil options rejected", func(t *testing.T) {
		t.Parallel()
		client := &azureClient{baseUrl: "http://example.invalid"}
		err := client.Download(t.Context(), t.TempDir(), nil)
		require.EqualError(t, err, "options cannot be nil")
	})

	t.Run("non-200 from azure fails", func(t *testing.T) {
		t.Parallel()
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusForbidden)
		}))
		t.Cleanup(server.Close)

		client := &azureClient{baseUrl: server.URL}
		err := client.Download(t.Context(), t.TempDir(), &git.CloneOptions{
			URL: "https://dev.azure.com/Organisation/Project/_git/Repository",
		})
		require.Error(t, err)
		require.ErrorContains(t, err, "failed to download a zip file")
	})
}

func TestREQ_STK_03_AzureLatestCommitID_NilOptions(t *testing.T) {
	t.Parallel()
	client := &azureClient{baseUrl: "http://example.invalid"}
	_, err := client.LatestCommitID(t.Context(), "https://dev.azure.com/Organisation/Project/_git/Repository", "refs/heads/main", nil)
	require.EqualError(t, err, "options cannot be nil")
}

type bogusAuth struct{}

func (bogusAuth) String() string { return "bogus" }
func (bogusAuth) Name() string   { return "bogus" }
