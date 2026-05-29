package notifications

import "context"

type Repository interface {
	Create(ctx context.Context, n Notification) (*Notification, error)
	ListByUser(ctx context.Context, userID string, limit int) ([]Notification, error)
	CountUnreadByUser(ctx context.Context, userID string) (int, error)
	MarkAsRead(ctx context.Context, userID, notificationID string) error
	MarkAllAsRead(ctx context.Context, userID string) error
}
