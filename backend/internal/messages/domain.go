// Package messages contains the domain logic for the messages module.
package messages

import "time"

const SystemUserID = "00000000-0000-0000-0000-000000000000"

// Message represents a chat message within a transaction.
// Pure business data — zero external dependencies.
type Message struct {
	ID            string    `json:"id"`
	TransactionID string    `json:"transaction_id"`
	SenderID      string    `json:"sender_id"`
	Content       string    `json:"content"`
	CreatedAt     time.Time `json:"created_at"`
	Status        string    `json:"status,omitempty"`
	ListingTitle  string    `json:"listing_title,omitempty"`
	ListingPhoto  string    `json:"listing_photo,omitempty"`
	BorrowerID    string    `json:"borrower_id,omitempty"`
	OwnerID       string    `json:"owner_id,omitempty"`
}
