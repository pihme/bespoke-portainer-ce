package roar

import (
	"github.com/RoaringBitmap/roaring/v2"
)

type Roar[T ~int] struct {
	rb *roaring.Bitmap
}

// Add adds the given element to the bitmap
func (r *Roar[T]) Add(e T) {
	if r.rb == nil {
		r.rb = roaring.New()
	}

	r.rb.AddInt(int(e))
}

// Contains returns whether the bitmap contains the given element or not
func (r *Roar[T]) Contains(e T) bool {
	if r.rb == nil {
		return false
	}

	return r.rb.ContainsInt(int(e))
}

// FromSlice creates a Roar by adding all elements from the provided slices
func FromSlice[T ~int](ess ...[]T) Roar[T] {
	var r Roar[T]

	for _, es := range ess {
		for _, e := range es {
			r.Add(e)
		}
	}

	return r
}
