package slicesx

import "slices"

// Checks if predicate returns truthy for any element of input. Iteration is stopped once predicate returns truthy.
func Some[T any](input []T, predicate func(T) bool) bool {
	return slices.ContainsFunc(input, predicate)
}
