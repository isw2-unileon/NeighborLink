package listings

import (
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"
)

// StorageService defines the contract for uploading listing photos.
// Dependency Inversion: el handler depende de esta interfaz, no de Supabase directamente.
type StorageService interface {
	UploadPhoto(listingID string, filename string, content io.Reader, contentType string) (string, error)
}

type supabaseStorageService struct {
	baseURL    string
	serviceKey string
	bucket     string
	httpClient *http.Client
}

// NewSupabaseStorageService creates a Supabase Storage implementation of StorageService.
func NewSupabaseStorageService(baseURL, serviceKey string) StorageService {
	return &supabaseStorageService{
		baseURL:    baseURL,
		serviceKey: serviceKey,
		bucket:     "listings-photos",
		httpClient: &http.Client{},
	}
}

func (s *supabaseStorageService) UploadPhoto(listingID, filename string, content io.Reader, contentType string) (string, error) {
	path := fmt.Sprintf("%s/%d_%s", listingID, time.Now().UnixNano(), filename)
	url := fmt.Sprintf("%s/storage/v1/object/%s/%s", s.baseURL, s.bucket, path)

	req, err := http.NewRequest(http.MethodPost, url, content)
	if err != nil {
		return "", fmt.Errorf("storage: failed to create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.serviceKey)
	req.Header.Set("Content-Type", contentType)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("storage: upload failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	slog.Info("supabase response", "status", resp.StatusCode, "body", string(body))
	if resp.StatusCode != http.StatusOK {
		slog.Error("storage: upload rejected", "status", resp.StatusCode, "body", string(body))
		return "", fmt.Errorf("storage: unexpected status %d", resp.StatusCode)
	}

	publicURL := fmt.Sprintf("%s/storage/v1/object/public/%s/%s", s.baseURL, s.bucket, path)
	return publicURL, nil
}
