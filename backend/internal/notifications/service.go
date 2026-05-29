package notifications

import "context"

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, userID, typ string, payload map[string]any) error {
	_, err := s.repo.Create(ctx, Notification{
		UserID:  userID,
		Type:    typ,
		Payload: payload,
		Read:    false,
	})
	return err
}
