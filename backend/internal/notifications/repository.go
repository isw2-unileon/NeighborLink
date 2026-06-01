package notifications

import "context"

// Repository defines the interface for data access operations related to notifications. This allows us to abstract away the underlying data store and makes it easier to test the service layer.
type Repository interface {
	Create(ctx context.Context, n Notification) (*Notification, error)
	ListByUser(ctx context.Context, userID string, limit int) ([]Notification, error)
	CountUnreadByUser(ctx context.Context, userID string) (int, error)
	MarkAsRead(ctx context.Context, userID, notificationID string) error
	MarkAllAsRead(ctx context.Context, userID string) error
}
