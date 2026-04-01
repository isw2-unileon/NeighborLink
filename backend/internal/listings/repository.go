// Package listings contains the domain logic for the listings module.
package listings

import "context"

// Repository defines what the domain needs from persistence.
type Repository interface {
	FindAll(ctx context.Context) ([]Listing, error)
	FindByID(ctx context.Context, id string) (*Listing, error)
	FindByOwner(ctx context.Context, ownerID string) ([]Listing, error)
}
