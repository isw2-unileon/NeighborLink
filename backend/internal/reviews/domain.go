// Package reviews contains the domain logic for the reviews module.
package reviews

import "time"

// Review represents a rating left by a user after a transaction.
// Pure business data — zero external dependencies.
type Review struct {
	ID            string    `json:"id"`
	TransactionID string    `json:"transaction_id"`
	ReviewerID    string    `json:"reviewer_id"`
	ReviewedID    string    `json:"reviewed_id"`
	Rating        int       `json:"rating"`
	Comment       string    `json:"comment"`
	CreatedAt     time.Time `json:"created_at"`
}
