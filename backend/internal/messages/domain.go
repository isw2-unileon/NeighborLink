// Package messages contains the domain logic for the messages module.
package messages

import "time"

// Message represents a chat message within a transaction.
// Pure business data — zero external dependencies.
type Message struct {
	ID            string    `json:"id"`
	TransactionID string    `json:"transaction_id"`
	SenderID      string    `json:"sender_id"`
	Content       string    `json:"content"`
	CreatedAt     time.Time `json:"created_at"`
}
