package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
)

// coordinates holds the result of a geocoding lookup.
type coordinates struct {
	Lat float64
	Lng float64
}

// nominatimResult es la estructura mínima que nos interesa de la respuesta de Nominatim.
type nominatimResult struct {
	Lat string `json:"lat"`
	Lon string `json:"lon"`
}

// geocode resuelve una dirección en texto a coordenadas usando Nominatim.
// Si la dirección no se encuentra o hay un error de red, devuelve nil, nil
// — el registro continúa sin coordenadas (location = NULL en BD).
func geocode(ctx context.Context, client *http.Client, address string) (*coordinates, error) {
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
		return nil, nil // dirección no encontrada — no es un error fatal
	}

	lat, err := strconv.ParseFloat(results[0].Lat, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid lat %q: %w", results[0].Lat, err)
	}
	lng, err := strconv.ParseFloat(results[0].Lon, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid lon %q: %w", results[0].Lon, err)
	}

	return &coordinates{Lat: lat, Lng: lng}, nil
}
