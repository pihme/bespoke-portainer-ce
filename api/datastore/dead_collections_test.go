package datastore

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/portainer/portainer/api/database/boltdb"

	"github.com/stretchr/testify/require"
)

// deadCollections are the BoltDB collections TAI-020 removes: nothing reads
// them on a fresh bespoke instance (TAI-022).
var deadCollections = []string{
	"roles", "schedules", "extension", "dockerhub", "tunnel_server", "api_key", "helm_user_repository",
}

// TestREQ_TAI_020_FreshStoreHasNoDeadCollections proves that a fresh store
// no longer creates the seven dead collections and still creates the kept ones.
func TestREQ_TAI_020_FreshStoreHasNoDeadCollections(t *testing.T) {
	_, store := MustNewTestStore(t, true, false)
	require.NoError(t, store.connection.Close())

	con, ok := store.connection.(*boltdb.DbConnection)
	require.True(t, ok)

	raw, err := con.ExportJSON(con.GetDatabaseFilePath(), false)
	require.NoError(t, err)

	buckets := map[string]json.RawMessage{}
	require.NoError(t, json.Unmarshal(raw, &buckets))

	for _, name := range deadCollections {
		require.NotContainsf(t, buckets, name, "bucket %s should not be created", name)
	}

	for _, name := range []string{"endpoint_groups", "resource_control", "endpoints", "settings", "stacks", "users", "version"} {
		require.Containsf(t, buckets, name, "bucket %s should still be created", name)
	}
}

// TestREQ_TAI_020_DeadDataServicesAreGone proves that the data services of the
// seven dead collections are deleted.
func TestREQ_TAI_020_DeadDataServicesAreGone(t *testing.T) {
	for _, dir := range []string{"role", "schedule", "extension", "dockerhub", "tunnelserver", "apikeyrepository", "helmuserrepository"} {
		_, err := os.Stat(filepath.Join("..", "dataservices", dir))
		require.Truef(t, os.IsNotExist(err), "api/dataservices/%s should be removed", dir)
	}
}

// TestREQ_TAI_021_FreshStoreHasNoEdgeRelationCollections proves that a fresh
// store no longer creates the always-empty Edge group, Edge job, Edge stack
// status and endpoint relation collections. The edge_stack collection
// followed in TAI-023.
func TestREQ_TAI_021_FreshStoreHasNoEdgeRelationCollections(t *testing.T) {
	_, store := MustNewTestStore(t, true, false)
	require.NoError(t, store.connection.Close())

	con, ok := store.connection.(*boltdb.DbConnection)
	require.True(t, ok)

	raw, err := con.ExportJSON(con.GetDatabaseFilePath(), false)
	require.NoError(t, err)

	buckets := map[string]json.RawMessage{}
	require.NoError(t, json.Unmarshal(raw, &buckets))

	for _, name := range []string{"edgegroups", "edgejobs", "edge_stack_status", "endpoint_relations"} {
		require.NotContainsf(t, buckets, name, "bucket %s should not be created", name)
	}

	for _, name := range []string{"endpoint_groups", "resource_control"} {
		require.Containsf(t, buckets, name, "bucket %s should still be created", name)
	}

	for _, dir := range []string{"edgegroup", "edgejob", "edgestackstatus", "endpointrelation"} {
		_, err := os.Stat(filepath.Join("..", "dataservices", dir))
		require.Truef(t, os.IsNotExist(err), "api/dataservices/%s should be removed", dir)
	}
}

// TestREQ_TAI_021_FreshStoreHasNoAllowList proves that the always-empty
// allowlist collection and its data service are gone. The outbound
// protection now runs on the fixed ssrf.DisabledPolicy.
func TestREQ_TAI_021_FreshStoreHasNoAllowList(t *testing.T) {
	_, store := MustNewTestStore(t, true, false)
	require.NoError(t, store.connection.Close())

	con, ok := store.connection.(*boltdb.DbConnection)
	require.True(t, ok)

	raw, err := con.ExportJSON(con.GetDatabaseFilePath(), false)
	require.NoError(t, err)

	buckets := map[string]json.RawMessage{}
	require.NoError(t, json.Unmarshal(raw, &buckets))
	require.NotContains(t, buckets, "allowlist")

	_, err = os.Stat(filepath.Join("..", "dataservices", "allowlist"))
	require.True(t, os.IsNotExist(err), "api/dataservices/allowlist should be removed")
}

// tai023Collections are the remaining always-empty collections TAI-023
// removes, with their data service folders.
var tai023Collections = map[string]string{
	"webhooks":        "webhook",
	"pending_actions": "pendingactions",
	"edge_stack":      "edgestack",
	"teams":           "team",
	"team_membership": "teammembership",
}

// TestREQ_TAI_023_FreshStoreHasNoRemainingEmptyCollections proves that a
// fresh store no longer creates the collections TAI-023 removes and that
// their data services are gone, while the kept collections stay.
func TestREQ_TAI_023_FreshStoreHasNoRemainingEmptyCollections(t *testing.T) {
	_, store := MustNewTestStore(t, true, false)
	require.NoError(t, store.connection.Close())

	con, ok := store.connection.(*boltdb.DbConnection)
	require.True(t, ok)

	raw, err := con.ExportJSON(con.GetDatabaseFilePath(), false)
	require.NoError(t, err)

	buckets := map[string]json.RawMessage{}
	require.NoError(t, json.Unmarshal(raw, &buckets))

	for bucket, dir := range tai023Collections {
		require.NotContainsf(t, buckets, bucket, "bucket %s should not be created", bucket)

		_, err := os.Stat(filepath.Join("..", "dataservices", dir))
		require.Truef(t, os.IsNotExist(err), "api/dataservices/%s should be removed", dir)
	}

	for _, name := range []string{"endpoint_groups", "resource_control", "endpoints", "settings", "stacks", "version"} {
		require.Containsf(t, buckets, name, "bucket %s should still be created", name)
	}
}
