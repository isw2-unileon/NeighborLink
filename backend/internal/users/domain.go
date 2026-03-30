// Package users contains the domain logic for the users module.
package users

import "time"

// User represents the core domain entity.
// Pure business data — zero external dependencies.
type User struct {
	ID              string    `json:"id"`
	Email           string    `json:"email"`
	Name            string    `json:"name"`
	AvatarURL       string    `json:"avatar_url"`
	ReputationScore int       `json:"reputation_score"`
	CreatedAt       time.Time `json:"created_at"`
}
