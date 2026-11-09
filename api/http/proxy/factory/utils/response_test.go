package utils

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestWriteAccessDeniedResponse(t *testing.T) {
	t.Parallel()
	r, err := WriteAccessDeniedResponse()
	require.NoError(t, err)
	defer func() {
		err = r.Body.Close()
		require.NoError(t, err)
	}()

	require.NotNil(t, r)
	require.Equal(t, "application/json", r.Header.Get("content-type"))
	require.Equal(t, http.StatusForbidden, r.StatusCode)

	body, err := io.ReadAll(r.Body)
	require.NoError(t, err)
	require.Contains(t, string(body), "access denied to resource")
}

func TestRewriteAccessDeniedResponse(t *testing.T) {
	t.Parallel()

	resp := &http.Response{
		Header: http.Header{"Content-Type": []string{"application/json"}},
		Body:   io.NopCloser(strings.NewReader(`{"old":true}`)),
	}
	require.NoError(t, RewriteAccessDeniedResponse(resp))
	require.Equal(t, http.StatusForbidden, resp.StatusCode)

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Contains(t, string(body), "access denied to resource")
	require.Equal(t, int64(len(body)), resp.ContentLength)
}

func TestRewriteResponse(t *testing.T) {
	t.Parallel()

	resp := &http.Response{
		Header: http.Header{"Content-Type": []string{"application/json"}},
	}
	payload := map[string]any{"ok": true}
	require.NoError(t, RewriteResponse(resp, payload, http.StatusOK))
	require.Equal(t, http.StatusOK, resp.StatusCode)
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Contains(t, string(body), `"ok"`)
	require.Equal(t, strconv.Itoa(len(body)), resp.Header.Get("Content-Length"))

	// nil Header: getContentType is empty, marshal fails
	resp2 := &http.Response{}
	require.Error(t, RewriteResponse(resp2, map[string]any{"x": 1}, http.StatusCreated))

	resp3 := &http.Response{Header: http.Header{"Content-Type": []string{"text/plain"}}}
	require.Error(t, RewriteResponse(resp3, payload, http.StatusOK))

	resp4 := &http.Response{Header: http.Header{"Content-Type": []string{"application/yaml"}}}
	require.NoError(t, RewriteResponse(resp4, map[string]any{"name": "n"}, http.StatusAccepted))
	yb, err := io.ReadAll(resp4.Body)
	require.NoError(t, err)
	require.Contains(t, string(yb), "name:")
}

func TestGetResponseAsJSONObject(t *testing.T) {
	t.Parallel()

	resp := &http.Response{
		Header: http.Header{"Content-Type": []string{"application/json"}},
		Body:   io.NopCloser(strings.NewReader(`{"id":7,"name":"ctr"}`)),
	}
	obj, err := GetResponseAsJSONObject(resp)
	require.NoError(t, err)
	require.Equal(t, float64(7), obj["id"])
	require.Equal(t, "ctr", obj["name"])

	arrResp := &http.Response{
		Header: http.Header{"Content-Type": []string{"application/json"}},
		Body:   io.NopCloser(strings.NewReader(`[1,2]`)),
	}
	obj, err = GetResponseAsJSONObject(arrResp)
	require.NoError(t, err)
	require.Nil(t, obj)

	_, err = GetResponseAsJSONObject(&http.Response{
		Header: http.Header{"Content-Type": []string{"application/json"}},
		Body:   nil,
	})
	require.Error(t, err)
}

func TestGetResponseAsJSONArray(t *testing.T) {
	t.Parallel()

	resp := &http.Response{
		Header: http.Header{"Content-Type": []string{"application/json"}},
		Body:   io.NopCloser(strings.NewReader(`[{"a":1},{"a":2}]`)),
	}
	arr, err := GetResponseAsJSONArray(resp)
	require.NoError(t, err)
	require.Len(t, arr, 2)

	msgResp := &http.Response{
		Header: http.Header{"Content-Type": []string{"application/json"}},
		Body:   io.NopCloser(strings.NewReader(`{"message":"boom"}`)),
	}
	_, err = GetResponseAsJSONArray(msgResp)
	require.Error(t, err)
	require.Contains(t, err.Error(), "boom")

	objResp := &http.Response{
		Header: http.Header{"Content-Type": []string{"application/json"}},
		Body:   io.NopCloser(strings.NewReader(`{"no":"message"}`)),
	}
	_, err = GetResponseAsJSONArray(objResp)
	require.Error(t, err)
	require.Contains(t, err.Error(), "expected JSON array, got JSON object")

	numResp := &http.Response{
		Header: http.Header{"Content-Type": []string{"application/json"}},
		Body:   io.NopCloser(strings.NewReader(`42`)),
	}
	_, err = GetResponseAsJSONArray(numResp)
	require.Error(t, err)
	require.Contains(t, err.Error(), "expected JSON array")

	_, err = GetResponseAsJSONArray(&http.Response{
		Header: http.Header{"Content-Type": []string{"application/json"}},
		Body:   nil,
	})
	require.Error(t, err)

	nullResp := &http.Response{
		Header: http.Header{"Content-Type": []string{"application/json"}},
		Body:   io.NopCloser(strings.NewReader(`null`)),
	}
	arr, err = GetResponseAsJSONArray(nullResp)
	require.NoError(t, err)
	require.Nil(t, arr)
}

func TestGetResponseBodyGzip(t *testing.T) {
	t.Parallel()

	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	_, err := gz.Write([]byte(`{"gzip":true}`))
	require.NoError(t, err)
	require.NoError(t, gz.Close())

	resp := &http.Response{
		Header: http.Header{
			"Content-Type":     []string{"application/json"},
			"Content-Encoding": []string{"gzip"},
		},
		Body: io.NopCloser(bytes.NewReader(buf.Bytes())),
	}
	data, err := getResponseBody(resp)
	require.NoError(t, err)
	m, ok := data.(map[string]any)
	require.True(t, ok)
	require.Equal(t, true, m["gzip"])
	require.Empty(t, resp.Header.Get("Content-Encoding"))
}

func TestGetContentType(t *testing.T) {
	t.Parallel()
	resp := &http.Response{Header: http.Header{"Content-Type": []string{"application/json"}}}
	require.Equal(t, "application/json", getContentType(resp))
	require.Equal(t, "", getContentType(&http.Response{Header: http.Header{}}))
}
