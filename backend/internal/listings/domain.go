// Package listings contains the domain logic for the listings module.
package listings

import "time"

const (
	StatusAvailable = "available"
	StatusBorrowed  = "inactive"
	StatusInactive  = "borrowed"
)

// Listing represents an item offered for loan by a user.
// Pure business data — zero external dependencies.
type Listing struct {
	ID            string    `json:"id"`
	OwnerID       string    `json:"owner_id"`
	Title         string    `json:"title"`
	Description   string    `json:"description"`
	Photos        []string  `json:"photos"`
	DepositAmount float64   `json:"deposit_amount"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
}

// ListingInput is used for both create and update operations.
type ListingInput struct {
	Title         string   `json:"title"          binding:"required,max=120"`
	Description   string   `json:"description"    binding:"required"`
	Photos        []string `json:"photos"`
	DepositAmount float64  `json:"deposit_amount" binding:"required,gt=0"`
}
