package errors_test

import (
	"errors"
	"fmt"
	"testing"

	httperrors "github.com/portainer/portainer/api/http/errors"

	"github.com/stretchr/testify/require"
)

func TestConflictError(t *testing.T) {
	t.Parallel()
	err := httperrors.NewConflictError("already exists")
	require.Equal(t, "already exists", err.Error())
	require.True(t, httperrors.IsConflictError(err))
	require.True(t, httperrors.IsConflictError(fmt.Errorf("wrap: %w", err)))
	require.False(t, httperrors.IsConflictError(errors.New("other")))
}

func TestInvalidPayloadError(t *testing.T) {
	t.Parallel()
	err := httperrors.NewInvalidPayloadError("bad json")
	require.Equal(t, "bad json", err.Error())
	require.True(t, httperrors.IsInvalidPayloadError(err))
	require.True(t, httperrors.IsInvalidPayloadError(fmt.Errorf("wrap: %w", err)))
	require.False(t, httperrors.IsInvalidPayloadError(errors.New("other")))
}

func TestSentinelErrors(t *testing.T) {
	t.Parallel()
	require.Equal(t, "Access denied to environment", httperrors.ErrEndpointAccessDenied.Error())
	require.Equal(t, "Unauthorized", httperrors.ErrUnauthorized.Error())
	require.Equal(t, "Access denied to resource", httperrors.ErrResourceAccessDenied.Error())
}
