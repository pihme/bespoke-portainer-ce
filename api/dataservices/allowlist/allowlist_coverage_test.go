package allowlist_test

import (
	"net"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/dataservices/allowlist"
	"github.com/portainer/portainer/api/datastore"

	"github.com/stretchr/testify/require"
)

const unknownAllowListKey portainer.AllowListKey = 99

// TestREQ_SET_03_BucketName reports the allowlist bucket on the service and
// inside a transaction.
func TestREQ_SET_03_BucketName(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	require.Equal(t, "allowlist", store.AllowList().BucketName())
	require.Equal(t, allowlist.BucketName, store.AllowListService.BucketName())

	require.NoError(t, store.ViewTx(func(tx dataservices.DataStoreTx) error {
		require.Equal(t, "allowlist", tx.AllowList().BucketName())
		return nil
	}))
}

// TestREQ_SET_03_DefaultSSRFModeOff pins the default SSRF mode when no
// allowlist row has been written yet.
func TestREQ_SET_03_DefaultSSRFModeOff(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	got, err := store.AllowList().Read(portainer.AllowListSSRF)
	require.NoError(t, err)
	require.Equal(t, portainer.SSRFModeOff, got.Mode)
	require.Empty(t, got.Entries)

	parsed, err := store.AllowList().ReadParsed(portainer.AllowListSSRF)
	require.NoError(t, err)
	require.Equal(t, portainer.SSRFModeOff, parsed.Mode)
	require.Empty(t, parsed.Hosts)
	require.Empty(t, parsed.Nets)
}

// TestREQ_SET_03_ReadParsedCacheMiss loads and caches a parsed allowlist for
// a key that was not warmed during NewService.
func TestREQ_SET_03_ReadParsedCacheMiss(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	parsed, err := store.AllowList().ReadParsed(unknownAllowListKey)
	require.NoError(t, err)
	require.Equal(t, portainer.SSRFModeOff, parsed.Mode)
	require.Empty(t, parsed.Hosts)

	// Second call should hit the cache populated by the miss path.
	again, err := store.AllowList().ReadParsed(unknownAllowListKey)
	require.NoError(t, err)
	require.Equal(t, parsed, again)
}

// TestREQ_SET_03_ReadParsedTxCacheHitAndMiss covers ServiceTx.ReadParsed for
// the warmed SSRF key and for an unknown key.
func TestREQ_SET_03_ReadParsedTxCacheHitAndMiss(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	require.NoError(t, store.AllowList().Update(portainer.AllowListSSRF, &portainer.AllowList{
		ID:      portainer.AllowListSSRF,
		Mode:    portainer.SSRFModeAudit,
		Entries: []string{"git.example.test", "10.1.0.0/16"},
	}))

	require.NoError(t, store.ViewTx(func(tx dataservices.DataStoreTx) error {
		parsed, err := tx.AllowList().ReadParsed(portainer.AllowListSSRF)
		require.NoError(t, err)
		require.Equal(t, portainer.SSRFModeAudit, parsed.Mode)
		require.True(t, parsed.Hosts["git.example.test"])
		require.Len(t, parsed.Nets, 1)
		require.Equal(t, &net.IPNet{
			IP:   net.IP{10, 1, 0, 0}.To4(),
			Mask: net.CIDRMask(16, 32),
		}, parsed.Nets[0])

		miss, err := tx.AllowList().ReadParsed(unknownAllowListKey)
		require.NoError(t, err)
		require.Equal(t, portainer.SSRFModeOff, miss.Mode)
		require.Empty(t, miss.Hosts)
		return nil
	}))
}

// TestREQ_SET_03_PopulateCacheFromExistingRow rebuilds the service cache from
// a previously persisted SSRF allowlist on NewService.
func TestREQ_SET_03_PopulateCacheFromExistingRow(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	expected := &portainer.AllowList{
		ID:      portainer.AllowListSSRF,
		Mode:    portainer.SSRFModeEnforce,
		Entries: []string{"compose.example.test"},
	}
	require.NoError(t, store.AllowList().Update(portainer.AllowListSSRF, expected))

	svc, err := allowlist.NewService(store.Connection())
	require.NoError(t, err)

	parsed, err := svc.ReadParsed(portainer.AllowListSSRF)
	require.NoError(t, err)
	require.Equal(t, portainer.SSRFModeEnforce, parsed.Mode)
	require.True(t, parsed.Hosts["compose.example.test"])

	got, err := svc.Read(portainer.AllowListSSRF)
	require.NoError(t, err)
	require.Equal(t, expected, got)
}

// TestREQ_SET_03_UpdateModesCycles persists audit and enforce modes used by
// local Git/Helm/compose SSRF checks.
func TestREQ_SET_03_UpdateModesCycles(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	for _, mode := range []portainer.SSRFMode{
		portainer.SSRFModeOff,
		portainer.SSRFModeAudit,
		portainer.SSRFModeEnforce,
	} {
		require.NoError(t, store.AllowList().Update(portainer.AllowListSSRF, &portainer.AllowList{
			ID:      portainer.AllowListSSRF,
			Mode:    mode,
			Entries: []string{"proxy.example.test"},
		}))
		parsed, err := store.AllowList().ReadParsed(portainer.AllowListSSRF)
		require.NoError(t, err)
		require.Equal(t, mode, parsed.Mode)
		require.True(t, parsed.Hosts["proxy.example.test"])
	}
}
