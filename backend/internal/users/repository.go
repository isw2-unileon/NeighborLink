package users

import "context"

// Repository defines what the domain needs from persistence.
// This interface belongs to the domain package — NOT to infrastructure.
// This is the Dependency Inversion Principle from SOLID in action.
type Repository interface {
	FindAll(ctx context.Context) ([]User, error)
	FindByID(ctx context.Context, id string) (*User, error)
	Update(ctx context.Context, id string, input UpdateUserInput) (*User, error)
}
