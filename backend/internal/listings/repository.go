package listings

import "context"

type Repository interface {
	FindAll(ctx context.Context, filters FilterParams) ([]Listing, error)
	FindByID(ctx context.Context, id string) (*Listing, error)
	FindByOwner(ctx context.Context, ownerID string) ([]Listing, error)
	Create(ctx context.Context, ownerID string, input ListingInput) (*Listing, error)
	Update(ctx context.Context, id string, input ListingInput) (*Listing, error)
	Delete(ctx context.Context, id string) error
	AddPhoto(ctx context.Context, id string, photoURL string) (*Listing, error)
}
