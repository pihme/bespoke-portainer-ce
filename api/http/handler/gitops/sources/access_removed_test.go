package sources

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/portainer/portainer/api/datastore"

	"github.com/stretchr/testify/require"
)

// REQ-TAI-001: per-user/per-team source access control is removed; the
// former PUT /gitops/sources/{id}/access endpoint is no longer routed.
func TestREQ_TAI_001_SourceAccessEndpointRemoved(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	h := newTestHandler(t, store)

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, buildUpdateAccessReq(t, 1, 1, []byte(`{"public":true}`)))

	require.Equal(t, http.StatusNotFound, rr.Code)
}
