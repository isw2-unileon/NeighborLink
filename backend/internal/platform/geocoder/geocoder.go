package geocoder

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
)

// Coordinates holds the result of a geocoding lookup.
type Coordinates struct {
	Lat float64
	Lng float64
}

type nominatimResult struct {
	Lat string `json:"lat"`
	Lon string `json:"lon"`
}

// Geocode resuelve una dirección en texto a coordenadas usando Nominatim.
// Si la dirección no se encuentra devuelve nil, nil — el llamador decide
// si continuar sin coordenadas o devolver error.
func Geocode(ctx context.Context, client *http.Client, address string) (*Coordinates, error) {
	reqURL := fmt.Sprintf(
		"https://nominatim.openstreetmap.org/search?q=%s&format=json&limit=1",
		url.QueryEscape(address),
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept-Language", "es")
	req.Header.Set("User-Agent", "NeighborLink/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var results []nominatimResult
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, nil
	}

	lat, err := strconv.ParseFloat(results[0].Lat, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid lat %q: %w", results[0].Lat, err)
	}
	lng, err := strconv.ParseFloat(results[0].Lon, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid lon %q: %w", results[0].Lon, err)
	}

	return &Coordinates{Lat: lat, Lng: lng}, nil
}
