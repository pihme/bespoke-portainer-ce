package errors_test

import (
	"testing"

	httperrors "github.com/portainer/portainer/api/http/errors"

	"github.com/stretchr/testify/require"
)

func TestSentinelErrors(t *testing.T) {
	t.Parallel()
	require.Equal(t, "Unauthorized", httperrors.ErrUnauthorized.Error())
	require.Equal(t, "Access denied to resource", httperrors.ErrResourceAccessDenied.Error())
}
