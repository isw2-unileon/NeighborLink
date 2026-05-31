package notifications

import "context"

// Service provides business logic for managing notifications. It interacts with the Repository to perform data access operations and can contain additional logic such as validation, enrichment, or integration with other services.
type Service struct {
	repo Repository
}

// NewService creates a new instance of the Service with the given Repository. This allows us to inject different implementations of the Repository (e.g., for testing or different data stores) without changing the service logic.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Create generates a new notification for a user with the specified type and payload. It returns an error if the creation process fails.
func (s *Service) Create(ctx context.Context, userID, typ string, payload map[string]any) error {
	_, err := s.repo.Create(ctx, Notification{
		UserID:  userID,
		Type:    typ,
		Payload: payload,
		Read:    false,
	})
	return err
}
