package portainer

import "errors"

// ErrEdgeEnvironmentNotSupported is returned for an Edge environment left in
// the database: Edge computing and its reverse tunnel are removed (TAI-004).
var ErrEdgeEnvironmentNotSupported = errors.New("Edge environments are no longer supported")
