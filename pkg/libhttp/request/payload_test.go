package request_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/portainer/portainer/pkg/libhttp/request"

	"github.com/segmentio/encoding/json"
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

func Test_GetPayload(t *testing.T) {
	t.Parallel()
	payload := requestPayload{
		FirstName: "John",
		LastName:  "Doe",
	}

	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}

	r := httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(payloadJSON))

	newPayload, err := request.GetPayload[requestPayload](r)
	if err != nil {
		t.Fatal(err)
	}

	assert.Equal(t, payload, *newPayload)
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

func TestGetPayload_InvalidRequestPayload(t *testing.T) {
	t.Parallel()
	r := httptest.NewRequest(http.MethodPost, "/", bytes.NewReader([]byte("{")))
	_, err := request.GetPayload[requestPayload](r)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "Invalid request payload")
}
