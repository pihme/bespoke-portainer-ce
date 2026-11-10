package errors

import "errors"

var (
	// ErrUnauthorized Unauthorized error
	ErrUnauthorized = errors.New("Unauthorized")
	// ErrResourceAccessDenied Access denied to resource error
	ErrResourceAccessDenied = errors.New("Access denied to resource")
)
