package request

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRetrieveQueryParameter(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name     string
		url      string
		param    string
		optional bool
		want     string
		wantErr  bool
	}{
		{
			name:     "present parameter",
			url:      "http://example.com?name=value",
			param:    "name",
			optional: false,
			want:     "value",
			wantErr:  false,
		},
		{
			name:     "missing required parameter",
			url:      "http://example.com",
			param:    "name",
			optional: false,
			want:     "",
			wantErr:  true,
		},
		{
			name:     "missing optional parameter",
			url:      "http://example.com",
			param:    "name",
			optional: true,
			want:     "",
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tt.url, nil)
			got, err := RetrieveQueryParameter(req, tt.param, tt.optional)

			if (err != nil) != tt.wantErr {
				t.Errorf("RetrieveQueryParameter() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("RetrieveQueryParameter() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRetrieveNumericQueryParameter(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name     string
		url      string
		param    string
		optional bool
		want     int
		wantErr  bool
	}{
		{
			name:     "valid number",
			url:      "http://example.com?port=8080",
			param:    "port",
			optional: false,
			want:     8080,
			wantErr:  false,
		},
		{
			name:     "invalid number",
			url:      "http://example.com?port=abc",
			param:    "port",
			optional: false,
			want:     0,
			wantErr:  true,
		},
		{
			name:     "missing optional parameter",
			url:      "http://example.com",
			param:    "port",
			optional: true,
			want:     0,
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tt.url, nil)
			got, err := RetrieveNumericQueryParameter(req, tt.param, tt.optional)

			if (err != nil) != tt.wantErr {
				t.Errorf("RetrieveNumericQueryParameter() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("RetrieveNumericQueryParameter() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRetrieveBooleanQueryParameter(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name     string
		url      string
		param    string
		optional bool
		want     bool
		wantErr  bool
	}{
		{
			name:     "true value",
			url:      "http://example.com?enabled=true",
			param:    "enabled",
			optional: false,
			want:     true,
			wantErr:  false,
		},
		{
			name:     "false value",
			url:      "http://example.com?enabled=false",
			param:    "enabled",
			optional: false,
			want:     false,
			wantErr:  false,
		},
		{
			name:     "other value returns false",
			url:      "http://example.com?enabled=yes",
			param:    "enabled",
			optional: false,
			want:     false,
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tt.url, nil)
			got, err := RetrieveBooleanQueryParameter(req, tt.param, tt.optional)

			if (err != nil) != tt.wantErr {
				t.Errorf("RetrieveBooleanQueryParameter() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("RetrieveBooleanQueryParameter() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRetrieveArrayQueryParameter(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		url   string
		param string
		want  []string
	}{
		{
			name:  "multiple values",
			url:   "http://example.com?filter[]=foo&filter[]=bar",
			param: "filter",
			want:  []string{"foo", "bar"},
		},
		{
			name:  "single value",
			url:   "http://example.com?filter[]=test",
			param: "filter",
			want:  []string{"test"},
		},
		{
			name:  "no values returns nil",
			url:   "http://example.com",
			param: "filter",
			want:  nil,
		},
		{
			name:  "empty array",
			url:   "http://example.com?filter[]=",
			param: "filter",
			want:  []string{""},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tt.url, nil)
			_ = req.ParseForm()
			got := RetrieveArrayQueryParameter(req, tt.param)

			if tt.want == nil {
				if got != nil {
					t.Errorf("RetrieveArrayQueryParameter() = %v, want nil", got)
				}
				return
			}

			if len(got) != len(tt.want) {
				t.Errorf("RetrieveArrayQueryParameter() length = %v, want %v", len(got), len(tt.want))
				return
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Errorf("RetrieveArrayQueryParameter()[%d] = %v, want %v", i, got[i], tt.want[i])
				}
			}
		})
	}
}

func Test_getArrayQueryParameter(t *testing.T) {
	t.Parallel()

	makeRequest := func(rawQuery string) *http.Request {
		r := &http.Request{URL: &url.URL{RawQuery: rawQuery}}
		require.NoError(t, r.ParseForm())

		return r
	}

	tests := []struct {
		name     string
		query    string
		param    string
		expected []string
	}{
		{
			name:     "bracket notation",
			query:    "ids[]=1&ids[]=2",
			param:    "ids",
			expected: []string{"1", "2"},
		},
		{
			name:     "comma-separated",
			query:    "ids=1,2",
			param:    "ids",
			expected: []string{"1", "2"},
		},
		{
			name:     "plain repeated",
			query:    "ids=1&ids=2",
			param:    "ids",
			expected: []string{"1", "2"},
		},
		{
			name:     "single value",
			query:    "ids=1",
			param:    "ids",
			expected: []string{"1"},
		},
		{
			name:     "missing param returns nil",
			query:    "",
			param:    "ids",
			expected: nil,
		},
		{
			name:     "bracket notation takes priority over plain",
			query:    "ids[]=1&ids=2",
			param:    "ids",
			expected: []string{"1"},
		},
		{
			name:     "empty plain param returns nil",
			query:    "ids=",
			param:    "ids",
			expected: nil,
		},
		{
			name:     "trailing comma is ignored",
			query:    "ids=1,2,",
			param:    "ids",
			expected: []string{"1", "2"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := makeRequest(tt.query)
			result := RetrieveArrayQueryParameter(r, tt.param)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func multipartRequest(t *testing.T, fields map[string]string, fileField, fileName, fileContent string) *http.Request {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for name, value := range fields {
		require.NoError(t, writer.WriteField(name, value))
	}
	if fileField != "" {
		part, err := writer.CreateFormFile(fileField, fileName)
		require.NoError(t, err)
		_, err = part.Write([]byte(fileContent))
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())

	req := httptest.NewRequest(http.MethodPost, "http://example.com/upload", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}

func TestREQ_DED_07_RetrieveMultiPartFormFile_ReadsWholeUpload(t *testing.T) {
	t.Parallel()

	req := multipartRequest(t, nil, "file", "stack.yml", "services:\n  web:\n    image: nginx\n")
	content, filename, err := RetrieveMultiPartFormFile(req, "file")
	require.NoError(t, err)
	assert.Equal(t, "stack.yml", filename)
	assert.Equal(t, "services:\n  web:\n    image: nginx\n", string(content))
}

func TestREQ_DED_07_RetrieveMultiPartFormFile_MissingFieldErrors(t *testing.T) {
	t.Parallel()

	req := multipartRequest(t, map[string]string{"other": "x"}, "", "", "")
	_, _, err := RetrieveMultiPartFormFile(req, "file")
	require.Error(t, err)
}

func TestRetrieveMultiPartFormValue_RequiredAndOptional(t *testing.T) {
	t.Parallel()

	req := multipartRequest(t, map[string]string{"name": "web"}, "", "", "")
	got, err := RetrieveMultiPartFormValue(req, "name", false)
	require.NoError(t, err)
	assert.Equal(t, "web", got)

	_, err = RetrieveMultiPartFormValue(req, "missing", false)
	require.Error(t, err)
	assert.Equal(t, ErrMissingFormDataValue, err.Error())

	got, err = RetrieveMultiPartFormValue(req, "missing", true)
	require.NoError(t, err)
	assert.Empty(t, got)
}

func TestRetrieveMultiPartFormJSONValue_DecodesOrSkips(t *testing.T) {
	t.Parallel()

	type payload struct {
		Name string `json:"name"`
	}

	req := multipartRequest(t, map[string]string{"meta": `{"name":"web"}`}, "", "", "")
	var target payload
	require.NoError(t, RetrieveMultiPartFormJSONValue(req, "meta", &target, false))
	assert.Equal(t, "web", target.Name)

	req = multipartRequest(t, nil, "", "", "")
	require.NoError(t, RetrieveMultiPartFormJSONValue(req, "meta", &target, true))

	req = multipartRequest(t, nil, "", "", "")
	err := RetrieveMultiPartFormJSONValue(req, "meta", &target, false)
	require.Error(t, err)

	req = multipartRequest(t, map[string]string{"meta": "not-json"}, "", "", "")
	err = RetrieveMultiPartFormJSONValue(req, "meta", &target, false)
	require.Error(t, err)
}

func TestRetrieveNumericMultiPartFormValue(t *testing.T) {
	t.Parallel()

	req := multipartRequest(t, map[string]string{"count": "42"}, "", "", "")
	got, err := RetrieveNumericMultiPartFormValue(req, "count", false)
	require.NoError(t, err)
	assert.Equal(t, 42, got)

	req = multipartRequest(t, map[string]string{"count": "x"}, "", "", "")
	_, err = RetrieveNumericMultiPartFormValue(req, "count", false)
	require.Error(t, err)

	req = multipartRequest(t, nil, "", "", "")
	_, err = RetrieveNumericMultiPartFormValue(req, "count", false)
	require.Error(t, err)
}

func TestRetrieveBooleanMultiPartFormValue(t *testing.T) {
	t.Parallel()

	req := multipartRequest(t, map[string]string{"enabled": "true"}, "", "", "")
	got, err := RetrieveBooleanMultiPartFormValue(req, "enabled", false)
	require.NoError(t, err)
	assert.True(t, got)

	req = multipartRequest(t, map[string]string{"enabled": "no"}, "", "", "")
	got, err = RetrieveBooleanMultiPartFormValue(req, "enabled", false)
	require.NoError(t, err)
	assert.False(t, got)

	req = multipartRequest(t, nil, "", "", "")
	_, err = RetrieveBooleanMultiPartFormValue(req, "enabled", false)
	require.Error(t, err)
}

func TestRetrieveRouteVariableValue(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "/items/42", nil)
	_, err := RetrieveRouteVariableValue(req, "id")
	require.Error(t, err)
	assert.Equal(t, ErrInvalidRequestURL, err.Error())

	req = mux.SetURLVars(req, map[string]string{"id": "42"})
	got, err := RetrieveRouteVariableValue(req, "id")
	require.NoError(t, err)
	assert.Equal(t, "42", got)

	req = mux.SetURLVars(httptest.NewRequest(http.MethodGet, "/items/", nil), map[string]string{"id": ""})
	_, err = RetrieveRouteVariableValue(req, "id")
	require.Error(t, err)
}

func TestRetrieveNumericRouteVariableValue(t *testing.T) {
	t.Parallel()

	req := mux.SetURLVars(httptest.NewRequest(http.MethodGet, "/items/7", nil), map[string]string{"id": "7"})
	got, err := RetrieveNumericRouteVariableValue(req, "id")
	require.NoError(t, err)
	assert.Equal(t, 7, got)

	req = mux.SetURLVars(httptest.NewRequest(http.MethodGet, "/items/x", nil), map[string]string{"id": "x"})
	_, err = RetrieveNumericRouteVariableValue(req, "id")
	require.Error(t, err)

	req = httptest.NewRequest(http.MethodGet, "/items/1", nil)
	_, err = RetrieveNumericRouteVariableValue(req, "id")
	require.Error(t, err)
}

func TestRetrieveJSONQueryParameter(t *testing.T) {
	t.Parallel()

	type filter struct {
		Name string `json:"name"`
	}
	var target filter

	req := httptest.NewRequest(http.MethodGet, `http://example.com?filter={"name":"web"}`, nil)
	require.NoError(t, RetrieveJSONQueryParameter(req, "filter", &target, false))
	assert.Equal(t, "web", target.Name)

	req = httptest.NewRequest(http.MethodGet, "http://example.com", nil)
	require.NoError(t, RetrieveJSONQueryParameter(req, "filter", &target, true))

	req = httptest.NewRequest(http.MethodGet, "http://example.com", nil)
	err := RetrieveJSONQueryParameter(req, "filter", &target, false)
	require.Error(t, err)

	req = httptest.NewRequest(http.MethodGet, "http://example.com?filter=not-json", nil)
	err = RetrieveJSONQueryParameter(req, "filter", &target, false)
	require.Error(t, err)
}

func TestRetrieveNumberArrayQueryParameter(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "http://example.com?ids[]=1&ids[]=2", nil)
	got, err := RetrieveNumberArrayQueryParameter[int](req, "ids")
	require.NoError(t, err)
	assert.Equal(t, []int{1, 2}, got)

	req = httptest.NewRequest(http.MethodGet, "http://example.com?ids=3,4", nil)
	got, err = RetrieveNumberArrayQueryParameter[int](req, "ids")
	require.NoError(t, err)
	assert.Equal(t, []int{3, 4}, got)

	req = httptest.NewRequest(http.MethodGet, "http://example.com", nil)
	got, err = RetrieveNumberArrayQueryParameter[int](req, "ids")
	require.NoError(t, err)
	assert.Nil(t, got)

	req = httptest.NewRequest(http.MethodGet, "http://example.com?ids=1,x", nil)
	_, err = RetrieveNumberArrayQueryParameter[int](req, "ids")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "Unable to parse parameter")
}

func TestRetrieveBooleanQueryParameter_MissingRequired(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "http://example.com", nil)
	_, err := RetrieveBooleanQueryParameter(req, "enabled", false)
	require.Error(t, err)
}

func TestRetrieveNumericQueryParameter_MissingRequired(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "http://example.com", nil)
	_, err := RetrieveNumericQueryParameter(req, "port", false)
	require.Error(t, err)
}
