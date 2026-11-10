package response

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJSONWithStatus(t *testing.T) {
	t.Parallel()
	type TestData struct {
		Message string `json:"message"`
	}

	tests := []struct {
		name   string
		data   any
		status int
	}{
		{
			name:   "Success",
			data:   TestData{Message: "Hello, World!"},
			status: http.StatusOK,
		},
		{
			name:   "Internal Server Error",
			data:   TestData{Message: "Internal Server Error"},
			status: http.StatusInternalServerError,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()

			httpErr := JSONWithStatus(recorder, test.data, test.status)

			assert.Nil(t, httpErr)
			assert.Equal(t, test.status, recorder.Code)
			assert.Equal(t, "application/json", recorder.Header().Get("Content-Type"))

			var response TestData
			err := json.Unmarshal(recorder.Body.Bytes(), &response)

			require.NoError(t, err)
			assert.Equal(t, test.data, response)
		})
	}
}

func TestJSON(t *testing.T) {
	t.Parallel()
	type TestData struct {
		Message string `json:"message"`
	}

	tests := []struct {
		name   string
		data   any
		status int
	}{
		{
			name:   "Success",
			data:   TestData{Message: "Hello, World!"},
			status: http.StatusOK,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()

			httpErr := JSONWithStatus(recorder, test.data, test.status)

			assert.Nil(t, httpErr)
			assert.Equal(t, test.status, recorder.Code)
			assert.Equal(t, "application/json", recorder.Header().Get("Content-Type"))

			var response TestData
			err := json.Unmarshal(recorder.Body.Bytes(), &response)
			require.NoError(t, err)
			assert.Equal(t, test.data, response)
		})
	}
}

func TestYAML(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name     string
		data     any
		expected string
		invalid  bool
	}{
		{
			name:     "Success",
			data:     "key: value",
			expected: "key: value",
		},
		{
			name:     "Invalid Data",
			data:     123,
			expected: "",
			invalid:  true,
		},
		{
			name: "doesn't support an Object",
			data: map[string]any{
				"key": "value",
			},
			expected: "",
			invalid:  true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()

			httpErr := YAML(recorder, test.data)

			if test.invalid {
				assert.NotNil(t, httpErr)
				assert.Equal(t, http.StatusInternalServerError, httpErr.StatusCode)
				return
			}

			assert.Nil(t, httpErr)
			assert.Equal(t, http.StatusOK, recorder.Code)
			assert.Equal(t, "text/yaml", recorder.Header().Get("Content-Type"))
			assert.Equal(t, test.expected, recorder.Body.String())
		})
	}
}

func TestEmpty(t *testing.T) {
	t.Parallel()
	recorder := httptest.NewRecorder()

	httpErr := Empty(recorder)

	assert.Nil(t, httpErr)
	assert.Equal(t, http.StatusNoContent, recorder.Code)
}

type errWriter struct {
	header http.Header
	code   int
}

func (w *errWriter) Header() http.Header {
	if w.header == nil {
		w.header = make(http.Header)
	}
	return w.header
}
func (w *errWriter) Write([]byte) (int, error)  { return 0, errors.New("write failed") }
func (w *errWriter) WriteHeader(statusCode int) { w.code = statusCode }

func TestJSONWithStatus_EncodeError(t *testing.T) {
	t.Parallel()

	// json.Encoder fails on channels
	err := JSONWithStatus(&errWriter{}, make(chan int), http.StatusOK)
	require.NotNil(t, err)
	require.Equal(t, http.StatusInternalServerError, err.StatusCode)
}

func TestYAML_WriteErrorIsLogged(t *testing.T) {
	t.Parallel()

	err := YAML(&errWriter{}, "hello: world")
	require.Nil(t, err)
}
