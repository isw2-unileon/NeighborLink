package notifications

import "time"

type Notification struct {
	ID        string         `json:"id" db:"id"`
	UserID    string         `json:"user_id" db:"user_id"`
	Type      string         `json:"type" db:"type"`
	Payload   map[string]any `json:"payload" db:"payload"`
	Read      bool           `json:"read" db:"read"`
	CreatedAt time.Time      `json:"created_at" db:"created_at"`
}
