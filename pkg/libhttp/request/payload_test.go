package request_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/portainer/portainer/pkg/libhttp/request"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type requestPayload struct {
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

func (p *requestPayload) Validate(r *http.Request) error {
	return nil
}

type failingPayload struct {
	Name string `json:"name"`
}

func (p *failingPayload) Validate(r *http.Request) error {
	return assert.AnError
}

func TestDecodeAndValidateJSONPayload_InvalidJSON(t *testing.T) {
	t.Parallel()
	r := httptest.NewRequest(http.MethodPost, "/", bytes.NewReader([]byte("{")))
	err := request.DecodeAndValidateJSONPayload(r, &requestPayload{})
	require.Error(t, err)
}

func TestDecodeAndValidateJSONPayload_ValidationFailure(t *testing.T) {
	t.Parallel()
	r := httptest.NewRequest(http.MethodPost, "/", bytes.NewReader([]byte(`{"name":"x"}`)))
	err := request.DecodeAndValidateJSONPayload(r, &failingPayload{})
	require.Error(t, err)
	assert.ErrorIs(t, err, assert.AnError)
}
