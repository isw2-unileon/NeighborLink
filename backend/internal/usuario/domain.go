// Package usuario contains the domain logic for the usuario module.
package usuario

import "time"

// Usuario represents the core domain entity.
// This struct has zero external dependencies — it is pure business data.
type Usuario struct {
	ID        string    `json:"id"`
	Nombre    string    `json:"nombre"`
	Apellidos string    `json:"apellidos"`
	Edad      int       `json:"edad"`
	Correo    string    `json:"correo"`
	CreatedAt time.Time `json:"created_at"`
}
