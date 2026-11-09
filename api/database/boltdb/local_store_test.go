package boltdb

import (
	"bytes"
	"encoding/binary"
	"math"
	"os"
	"path/filepath"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/filesystem"

	"github.com/stretchr/testify/require"
)

// openTestDB opens a file-backed BoltDB in a temp dir and registers cleanup.
func openTestDB(t *testing.T) *DbConnection {
	t.Helper()
	conn := &DbConnection{Path: t.TempDir()}
	require.NoError(t, conn.Open())
	t.Cleanup(func() {
		_ = conn.Close()
	})
	return conn
}

func TestGetStorePathAndDatabaseFileHelpers(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	conn := &DbConnection{Path: dir}

	require.Equal(t, dir, conn.GetStorePath())
	require.Equal(t, DatabaseFileName, conn.GetDatabaseFileName())
	require.Equal(t, filesystem.JoinPaths(dir, DatabaseFileName), conn.GetDatabaseFilePath())

	_, err := conn.GetDatabaseFileSize()
	require.Error(t, err)

	require.NoError(t, conn.Open())
	t.Cleanup(func() { _ = conn.Close() })

	size, err := conn.GetDatabaseFileSize()
	require.NoError(t, err)
	require.Greater(t, size, int64(0))

	key := secretToEncryptionKey(passphrase)
	enc := &DbConnection{Path: dir, EncryptionKey: key}
	require.NoError(t, enc.SetEncrypted(true))
	require.Equal(t, EncryptedDatabaseFileName, enc.GetDatabaseFileName())
	require.Equal(t, filesystem.JoinPaths(dir, EncryptedDatabaseFileName), enc.GetDatabaseFilePath())
}

func TestClose_NilDBIsSafe(t *testing.T) {
	t.Parallel()
	conn := &DbConnection{}
	require.NoError(t, conn.Close())
}

func TestConnectionCRUD_LocalRoundTrip(t *testing.T) {
	t.Parallel()
	conn := openTestDB(t)

	const bucket = "local-items"
	require.NoError(t, conn.SetServiceName(bucket))

	obj := testStruct{Key: "a", Value: "one"}
	require.NoError(t, conn.CreateObjectWithId(bucket, 10, obj))

	var got testStruct
	require.NoError(t, conn.GetObject(bucket, conn.ConvertToKey(10), &got))
	require.Equal(t, obj, got)

	exists, err := conn.KeyExists(bucket, conn.ConvertToKey(10))
	require.NoError(t, err)
	require.True(t, exists)

	missing, err := conn.KeyExists(bucket, conn.ConvertToKey(99))
	require.NoError(t, err)
	require.False(t, missing)

	raw, err := conn.GetRawBytes(bucket, conn.ConvertToKey(10))
	require.NoError(t, err)
	require.Contains(t, string(raw), `"a"`)

	_, err = conn.GetRawBytes(bucket, conn.ConvertToKey(99))
	require.True(t, dataservices.IsErrObjectNotFound(err))

	updated := testStruct{Key: "a", Value: "two"}
	require.NoError(t, conn.UpdateObject(bucket, conn.ConvertToKey(10), updated))
	require.NoError(t, conn.GetObject(bucket, conn.ConvertToKey(10), &got))
	require.Equal(t, updated, got)

	require.NoError(t, conn.CreateObjectWithStringId(bucket, []byte("str-id"), testStruct{Key: "s", Value: "string"}))
	require.NoError(t, conn.GetObject(bucket, []byte("str-id"), &got))
	require.Equal(t, "s", got.Key)

	// CreateObject allocates via NextSequence; keep it on a distinct id from 10.
	require.NoError(t, conn.CreateObject(bucket, func(seq uint64) (int, any) {
		return int(seq) + 100, testStruct{Key: "seq", Value: "from-seq"}
	}))

	idBefore := conn.GetNextIdentifier(bucket)
	idAfter := conn.GetNextIdentifier(bucket)
	require.Equal(t, idBefore+1, idAfter)

	var all []testStruct
	require.NoError(t, conn.GetAll(bucket, &testStruct{}, dataservices.AppendFn(&all)))
	require.GreaterOrEqual(t, len(all), 3)

	var prefixed []testStruct
	require.NoError(t, conn.GetAllWithKeyPrefix(bucket, []byte("str"), &testStruct{}, dataservices.AppendFn(&prefixed)))
	require.Len(t, prefixed, 1)
	require.Equal(t, "s", prefixed[0].Key)

	require.NoError(t, conn.DeleteObject(bucket, []byte("str-id")))
	exists, err = conn.KeyExists(bucket, []byte("str-id"))
	require.NoError(t, err)
	require.False(t, exists)

	require.NoError(t, conn.DeleteAllObjects(bucket, &testStruct{}, func(o any) (int, bool) {
		item, ok := o.(*testStruct)
		if !ok || item == nil {
			return 0, false
		}
		if item.Key == "a" {
			return 10, true
		}
		return 0, false
	}))
	exists, err = conn.KeyExists(bucket, conn.ConvertToKey(10))
	require.NoError(t, err)
	require.False(t, exists)
}

func TestUpdateObjectFunc_AppliesMutation(t *testing.T) {
	t.Parallel()
	conn := openTestDB(t)

	const bucket = "mutate"
	require.NoError(t, conn.SetServiceName(bucket))
	require.NoError(t, conn.CreateObjectWithId(bucket, 7, testStruct{Key: "k", Value: "v1"}))

	var current testStruct
	require.NoError(t, conn.UpdateObjectFunc(bucket, conn.ConvertToKey(7), &current, func() {
		current.Value = "v2"
	}))
	require.Equal(t, "v2", current.Value)

	var got testStruct
	require.NoError(t, conn.GetObject(bucket, conn.ConvertToKey(7), &got))
	require.Equal(t, "v2", got.Value)

	err := conn.UpdateObjectFunc(bucket, conn.ConvertToKey(404), &current, func() {})
	require.True(t, dataservices.IsErrObjectNotFound(err))
}

func TestTx_GetRawBytesKeyExistsCreateDeleteGetAll(t *testing.T) {
	t.Parallel()
	conn := openTestDB(t)

	const bucket = "tx-local"
	require.NoError(t, conn.SetServiceName(bucket))

	require.NoError(t, conn.UpdateTx(func(tx portainer.Transaction) error {
		if err := tx.CreateObjectWithStringId(bucket, []byte("pref-one"), testStruct{Key: "one", Value: "1"}); err != nil {
			return err
		}
		return tx.CreateObject(bucket, func(seq uint64) (int, any) {
			return int(seq), testStruct{Key: "seq", Value: "n"}
		})
	}))

	require.NoError(t, conn.ViewTx(func(tx portainer.Transaction) error {
		ok, err := tx.KeyExists(bucket, []byte("pref-one"))
		require.NoError(t, err)
		require.True(t, ok)

		raw, err := tx.GetRawBytes(bucket, []byte("pref-one"))
		require.NoError(t, err)
		require.Contains(t, string(raw), "one")

		_, err = tx.GetRawBytes(bucket, []byte("missing"))
		require.True(t, dataservices.IsErrObjectNotFound(err))

		var all []testStruct
		require.NoError(t, tx.GetAll(bucket, &testStruct{}, dataservices.AppendFn(&all)))
		require.GreaterOrEqual(t, len(all), 2)

		var pref []testStruct
		require.NoError(t, tx.GetAllWithKeyPrefix(bucket, []byte("pref-"), &testStruct{}, dataservices.AppendFn(&pref)))
		require.Len(t, pref, 1)
		return nil
	}))

	require.NoError(t, conn.UpdateTx(func(tx portainer.Transaction) error {
		if err := tx.CreateObjectWithId(bucket, 42, testStruct{Key: "del-me", Value: "x"}); err != nil {
			return err
		}
		return tx.DeleteAllObjects(bucket, &testStruct{}, func(o any) (int, bool) {
			item := o.(*testStruct)
			if item.Key == "del-me" {
				return 42, true
			}
			return 0, false
		})
	}))

	exists, err := conn.KeyExists(bucket, conn.ConvertToKey(42))
	require.NoError(t, err)
	require.False(t, exists)
}

func TestREQ_BKP_01_BackupToWriter(t *testing.T) {
	t.Parallel()
	conn := openTestDB(t)

	const bucket = "backup-bucket"
	require.NoError(t, conn.SetServiceName(bucket))
	require.NoError(t, conn.CreateObjectWithId(bucket, 1, testStruct{Key: "k", Value: "v"}))

	var buf bytes.Buffer
	require.NoError(t, conn.BackupTo(&buf))
	require.Greater(t, buf.Len(), 0)
}

func TestBackupAndRestoreMetadata(t *testing.T) {
	t.Parallel()
	conn := openTestDB(t)

	const bucket = "meta-bucket"
	require.NoError(t, conn.SetServiceName(bucket))
	_ = conn.GetNextIdentifier(bucket)
	_ = conn.GetNextIdentifier(bucket)

	meta, err := conn.BackupMetadata()
	require.NoError(t, err)
	require.Contains(t, meta, bucket)
	seq, ok := meta[bucket].(int)
	require.True(t, ok)
	require.GreaterOrEqual(t, seq, 2)

	// RestoreMetadata expects float64 values (JSON-decoded ints).
	restore := map[string]any{
		bucket:           float64(50),
		"skip-non-float": "not-a-number",
		"another-bucket": float64(3),
	}
	require.NoError(t, conn.RestoreMetadata(restore))

	meta2, err := conn.BackupMetadata()
	require.NoError(t, err)
	require.Equal(t, 50, meta2[bucket])
	require.Equal(t, 3, meta2["another-bucket"])
}

func TestExportJSONAndExportRaw(t *testing.T) {
	t.Parallel()
	conn := openTestDB(t)

	require.NoError(t, conn.SetServiceName("items"))
	require.NoError(t, conn.CreateObjectWithId("items", 1, testStruct{Key: "k", Value: "v"}))

	require.NoError(t, conn.SetServiceName("version"))
	require.NoError(t, conn.CreateObjectWithStringId("version", []byte("DB_VERSION"), "45"))

	require.NoError(t, conn.SetServiceName("settings"))
	require.NoError(t, conn.CreateObjectWithId("settings", 1, map[string]any{"LogoURL": "x"}))

	require.NoError(t, conn.SetServiceName("ssl"))
	require.NoError(t, conn.CreateObjectWithId("ssl", 1, map[string]any{"cert": "c"}))

	require.NoError(t, conn.SetServiceName("tunnel_server"))
	require.NoError(t, conn.CreateObjectWithId("tunnel_server", 1, map[string]any{"PrivateKeySeed": "s"}))

	dbPath := conn.GetDatabaseFilePath()
	require.NoError(t, conn.Close())

	exported, err := conn.ExportJSON(dbPath, true)
	require.NoError(t, err)
	require.Contains(t, string(exported), "__metadata")
	require.Contains(t, string(exported), "items")
	require.Contains(t, string(exported), "DB_VERSION")
	require.Contains(t, string(exported), "LogoURL")

	exportedNoMeta, err := conn.ExportJSON(dbPath, false)
	require.NoError(t, err)
	require.NotContains(t, string(exportedNoMeta), "__metadata")

	out := filepath.Join(t.TempDir(), "export.json")
	require.NoError(t, conn.ExportRaw(out))
	data, err := os.ReadFile(out)
	require.NoError(t, err)
	require.Contains(t, string(data), "items")

	missing := &DbConnection{Path: t.TempDir()}
	err = missing.ExportRaw(filepath.Join(t.TempDir(), "nope.json"))
	require.Error(t, err)
}

func TestREQ_SRV_07_EncryptedStoreCRUD(t *testing.T) {
	t.Parallel()

	key := secretToEncryptionKey(passphrase)
	conn := &DbConnection{
		Path:          t.TempDir(),
		EncryptionKey: key,
	}
	require.NoError(t, conn.SetEncrypted(true))
	require.True(t, conn.IsEncryptedStore())
	require.NoError(t, conn.Open())
	t.Cleanup(func() { _ = conn.Close() })

	const bucket = "enc-items"
	require.NoError(t, conn.SetServiceName(bucket))
	obj := testStruct{Key: "secret", Value: "payload"}
	require.NoError(t, conn.CreateObjectWithId(bucket, 1, obj))

	var got testStruct
	require.NoError(t, conn.GetObject(bucket, conn.ConvertToKey(1), &got))
	require.Equal(t, obj, got)

	raw, err := conn.GetRawBytes(bucket, conn.ConvertToKey(1))
	require.NoError(t, err)
	require.Contains(t, string(raw), "secret")
}

func TestKeyToString_ViaNotFoundErrors(t *testing.T) {
	t.Parallel()
	conn := openTestDB(t)
	const bucket = "keys"
	require.NoError(t, conn.SetServiceName(bucket))

	var obj testStruct
	err := conn.GetObject(bucket, conn.ConvertToKey(3), &obj)
	require.Error(t, err)
	require.Contains(t, err.Error(), "3")

	err = conn.GetObject(bucket, []byte("not-eight"), &obj)
	require.Error(t, err)
	require.Contains(t, err.Error(), "not-eight")

	big := make([]byte, 8)
	binary.BigEndian.PutUint64(big, uint64(math.MaxInt32)+10)
	err = conn.GetObject(bucket, big, &obj)
	require.Error(t, err)
	require.Contains(t, err.Error(), string(big))
}

func TestGetAllWithKeyPrefix_AppendErrorStops(t *testing.T) {
	t.Parallel()
	conn := openTestDB(t)
	const bucket = "prefix-err"
	require.NoError(t, conn.SetServiceName(bucket))
	require.NoError(t, conn.CreateObjectWithStringId(bucket, []byte("ab-1"), testStruct{Key: "1", Value: "a"}))

	err := conn.GetAllWithKeyPrefix(bucket, []byte("ab-"), &testStruct{}, func(o any) (any, error) {
		return o, os.ErrInvalid
	})
	require.ErrorIs(t, err, os.ErrInvalid)
}

func TestUnmarshalObject_NonStringJSONFailure(t *testing.T) {
	t.Parallel()
	conn := &DbConnection{}
	var n int
	err := conn.UnmarshalObject([]byte("not-json"), &n)
	require.Error(t, err)
	require.Contains(t, err.Error(), "Failed unmarshalling object")
}
