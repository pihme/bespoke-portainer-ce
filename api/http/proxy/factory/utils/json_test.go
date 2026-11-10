package utils

import (
	"bytes"
	"compress/gzip"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetJSONObject(t *testing.T) {
	t.Parallel()

	nested := map[string]any{"id": float64(1)}
	obj := map[string]any{"nested": nested, "other": "x"}

	require.Equal(t, nested, GetJSONObject(obj, "nested"))
	require.Nil(t, GetJSONObject(obj, "missing"))
	require.Nil(t, GetJSONObject(map[string]any{}, "nested"))
}

func TestMarshal(t *testing.T) {
	t.Parallel()

	data := map[string]any{"name": "local"}

	jsonBytes, err := marshal("application/json", data)
	require.NoError(t, err)
	require.Contains(t, string(jsonBytes), `"name"`)
	require.Contains(t, string(jsonBytes), `"local"`)

	jsonCharset, err := marshal("application/json; charset=utf-8", data)
	require.NoError(t, err)
	require.Contains(t, string(jsonCharset), `"local"`)

	_, err = marshal("", data)
	require.Error(t, err)

	yamlBytes, err := marshal("application/yaml", data)
	require.NoError(t, err)
	require.Contains(t, string(yamlBytes), "name:")
	require.Contains(t, string(yamlBytes), "local")

	_, err = marshal("text/plain", data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "not supported for marshaling")

	_, err = marshal("not a media type ;;;!!!", data)
	require.Error(t, err)
}

func TestUnmarshal(t *testing.T) {
	t.Parallel()

	var data any

	require.NoError(t, unmarshal("application/json", strings.NewReader(`{"ok":true}`), &data))
	m, ok := data.(map[string]any)
	require.True(t, ok)
	require.Equal(t, true, m["ok"])

	data = nil
	require.NoError(t, unmarshal("application/json; charset=utf-8", strings.NewReader(`{"n":1}`), &data))
	m, ok = data.(map[string]any)
	require.True(t, ok)
	require.Equal(t, float64(1), m["n"])

	require.Error(t, unmarshal("", strings.NewReader(`["a"]`), &data))

	data = nil
	require.NoError(t, unmarshal("application/yaml", strings.NewReader("name: stack\n"), &data))
	ym, ok := data.(map[string]any)
	require.True(t, ok)
	require.Equal(t, "stack", ym["name"])

	require.Error(t, unmarshal("text/html", strings.NewReader("x"), &data))
	require.Error(t, unmarshal(";;;bad", strings.NewReader("x"), &data))
	require.Error(t, unmarshal("application/json", strings.NewReader("{"), &data))
}

func TestGetBody(t *testing.T) {
	t.Parallel()

	_, err := getBody(nil, "application/json", false)
	require.Error(t, err)
	require.Contains(t, err.Error(), "empty response body")

	data, err := getBody(io.NopCloser(strings.NewReader(`{"a":1}`)), "application/json", false)
	require.NoError(t, err)
	m, ok := data.(map[string]any)
	require.True(t, ok)
	require.Equal(t, float64(1), m["a"])

	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	_, err = gz.Write([]byte(`{"gzipped":true}`))
	require.NoError(t, err)
	require.NoError(t, gz.Close())

	data, err = getBody(io.NopCloser(bytes.NewReader(buf.Bytes())), "application/json", true)
	require.NoError(t, err)
	m, ok = data.(map[string]any)
	require.True(t, ok)
	require.Equal(t, true, m["gzipped"])

	_, err = getBody(io.NopCloser(bytes.NewReader([]byte("not-gzip"))), "application/json", true)
	require.Error(t, err)

	_, err = getBody(io.NopCloser(strings.NewReader("{")), "application/json", false)
	require.Error(t, err)
}
