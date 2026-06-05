package transactions_test

import (
	"context"
	"fmt"
	"time"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/isw2-unileon/neighborlink/backend/internal/transactions"
)

// --- Shared Mocks ---

type noopPointsAdder struct{}
func (noopPointsAdder) AddPoints(_ context.Context, _ string, _ int) error { return nil }

type noopNotificationCreator struct{}
func (noopNotificationCreator) Create(_ context.Context, _ string, _ string, _ map[string]any) error { return nil }

type noopListingUpdater struct{}
func (noopListingUpdater) UpdateStatus(_ context.Context, _ string, _ string) error { return nil }

type mockAdminFinder struct{ AdminID string }
func (m *mockAdminFinder) FindFirstAdmin(_ context.Context) (string, error) { 
	if m.AdminID == "" { return "admin-1", nil }
	return m.AdminID, nil 
}

type mockMessageCreator struct{ Messages []string }
func (m *mockMessageCreator) CreateSystemMessage(_ context.Context, _, content string) error {
	m.Messages = append(m.Messages, content)
	return nil
}

type mockAdminChecker struct{ Admins map[string]bool }
func (m *mockAdminChecker) IsAdmin(_ context.Context, userID string) (bool, error) {
	if m.Admins == nil { return false, nil }
	return m.Admins[userID], nil
}

type fakeStripe struct {
	capturedAmount int64
	releasedAmount int64
	captureCalled  bool
	clientSecret   string
}
func (f *fakeStripe) AuthorizeDeposit(amountCents int64, _, _ string) (string, string, error) {
	f.capturedAmount = amountCents
	return "pi_fake", f.clientSecret, nil
}
func (f *fakeStripe) CaptureDeposit(_ string) error {
	f.captureCalled = true
	return nil
}
func (f *fakeStripe) ReleaseDeposit(_ string, amount int64) error {
	f.releasedAmount = amount
	return nil
}

type fakeListingSvc struct {
	updatedListingID string
	updatedStatus    string
}

func (f *fakeListingSvc) UpdateStatus(_ context.Context, id string, status string) error {
	f.updatedListingID = id
	f.updatedStatus = status
	return nil
}

type fakeRepository struct {
	transactions         []transactions.Transaction
	err                  error
	ownerByTransactionID map[string]string
	blockedDates         []transactions.DateRange
	reserved             *transactions.Transaction
}

func (f *fakeRepository) FindAll(_ context.Context) ([]transactions.Transaction, error) {
	return f.transactions, f.err
}

func (f *fakeRepository) FindByID(_ context.Context, id string) (*transactions.Transaction, error) {
	if f.err != nil { return nil, f.err }
	for _, t := range f.transactions {
		if t.ID == id { return &t, nil }
	}
	return nil, nil
}

func (f *fakeRepository) FindByListing(_ context.Context, listingID string) ([]transactions.Transaction, error) {
	if f.err != nil { return nil, f.err }
	var result []transactions.Transaction
	for _, t := range f.transactions {
		if t.ListingID == listingID { result = append(result, t) }
	}
	return result, nil
}

func (f *fakeRepository) FindByBorrower(_ context.Context, borrowerID string) ([]transactions.BorrowerTransaction, error) {
	if f.err != nil { return nil, f.err }
	var result []transactions.BorrowerTransaction
	for _, t := range f.transactions {
		if t.BorrowerID == borrowerID { result = append(result, transactions.BorrowerTransaction{Transaction: t}) }
	}
	return result, nil
}

func (f *fakeRepository) FindListingOwnerByTransactionID(_ context.Context, id string) (string, error) {
	if f.err != nil { return "", f.err }
	if f.ownerByTransactionID != nil {
		if ownerID, ok := f.ownerByTransactionID[id]; ok { return ownerID, nil }
	}
	return "", fmt.Errorf("transaction %s not found", id)
}

func (f *fakeRepository) FindListingOwnerAndTitle(_ context.Context, id string) (string, string, error) {
	if f.err != nil { return "", "", f.err }
	if f.ownerByTransactionID != nil {
		if ownerID, ok := f.ownerByTransactionID[id]; ok { return ownerID, "listing-title", nil }
	}
	return "", "", fmt.Errorf("transaction %s not found", id)
}

func (f *fakeRepository) FindListingInfoForRefund(_ context.Context, _ string) (string, string, int, error) {
	if f.err != nil { return "", "", 0, f.err }
	return "owner-1", "listing-title", 10000, nil
}

func (f *fakeRepository) UpdateDisputeRefund(_ context.Context, _ string, _ int) error {
	return f.err
}

func (f *fakeRepository) Create(_ context.Context, t transactions.Transaction) (*transactions.Transaction, error) {
	if f.err != nil { return nil, f.err }
	t.ID = fmt.Sprintf("fake-%d", len(f.transactions)+1)
	t.Status = "pending"
	f.transactions = append(f.transactions, t)
	created := f.transactions[len(f.transactions)-1]
	return &created, nil
}

func (f *fakeRepository) UpdatePaymentIntent(_ context.Context, id string, paymentIntentID string, paymentMethodID string, totalChargedCents int64) error {
	if f.err != nil { return f.err }
	now := time.Now()
	for i, t := range f.transactions {
		if t.ID == id {
			f.transactions[i].StripePaymentIntentID = paymentIntentID
			f.transactions[i].PaymentMethodID = paymentMethodID
			f.transactions[i].Status = "agreed"
			f.transactions[i].AgreedAt = &now
			return nil
		}
	}
	return fmt.Errorf("transaction %s not found", id)
}

func (f *fakeRepository) UpdateStatus(_ context.Context, id string, status string) error {
	if f.err != nil { return f.err }
	now := time.Now()
	for i, t := range f.transactions {
		if t.ID == id {
			f.transactions[i].Status = status
			switch status {
			case "handed_over": f.transactions[i].HandoverAt = &now
			case "returned": f.transactions[i].ReturnAt = &now
			}
			return nil
		}
	}
	return fmt.Errorf("transaction %s not found", id)
}

func (f *fakeRepository) Reserve(_ context.Context, t transactions.Transaction) (*transactions.Transaction, error) {
	if f.err != nil { return nil, f.err }
	t.ID = "new-id"
	f.reserved = &t
	return &t, nil
}

func (f *fakeRepository) FindBlockedDates(_ context.Context, _ string) ([]transactions.DateRange, error) {
	return f.blockedDates, f.err
}

func (f *fakeRepository) GenerateCode(_ context.Context, _, _ string) (string, error) {
	if f.err != nil { return "", f.err }
	return "123456", nil
}

func (f *fakeRepository) ValidateCode(_ context.Context, _, _, code string) (bool, error) {
	if f.err != nil { return false, f.err }
	return code == "123456", nil
}

func (f *fakeRepository) CancelByPaymentIntentID(_ context.Context, _ string) error {
	return f.err
}

// --- Shared Helpers ---

const testJWTSecret = "test-secret"

func makeToken(userID string) string {
	claims := jwt.MapClaims{
		"sub": userID,
		"exp": time.Now().Add(time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	t, _ := token.SignedString([]byte(testJWTSecret))
	return "Bearer " + t
}

func fakeAuthMiddleware(userID string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("userID", userID)
		c.Next()
	}
}
