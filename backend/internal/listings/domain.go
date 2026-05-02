package listings

import "time"

// tipos de estados de un listing.
const (
	StatusAvailable       = "available"
	StatusPendingHandover = "pending_handover"
	StatusPendingReturn   = "pending_return"
	StatusBorrowed        = "borrowed"
	StatusInactive        = "inactive"
)

// Category representa la categoría de un listing.
type Category string

// Listing representa un artículo listado en la plataforma.
const (
	CategoryHerramientas      Category = "herramientas"
	CategoryMaterialDeportivo Category = "material_deportivo"
	CategoryMaterialEducativo Category = "material_educativo"
	CategoryInformatico       Category = "informatico"
	CategoryElectrodomesticos Category = "electrodomesticos"
	CategoryJardineria        Category = "jardineria"
	CategoryVehiculos         Category = "vehiculos"
	CategoryOcioYJuegos       Category = "ocio_y_juegos"
	CategoryRopaYAccesorios   Category = "ropa_y_accesorios"
	CategoryOtros             Category = "otros"
)

// ValidCategories representa las categorías válidas para validación de input.
var ValidCategories = []Category{
	CategoryHerramientas, CategoryMaterialDeportivo, CategoryMaterialEducativo,
	CategoryInformatico, CategoryElectrodomesticos, CategoryJardineria,
	CategoryVehiculos, CategoryOcioYJuegos, CategoryRopaYAccesorios, CategoryOtros,
}

// IsValidCategory función de validación para asegurar que el input de categoría es correcto.
func IsValidCategory(c Category) bool {
	for _, v := range ValidCategories {
		if v == c {
			return true
		}
	}
	return false
}

// Listing representa un artículo listado en la plataforma.
type Listing struct {
	ID            string    `json:"id"`
	OwnerID       string    `json:"owner_id"`
	Title         string    `json:"title"`
	Description   string    `json:"description"`
	Photos        []string  `json:"photos"`
	DepositAmount float64   `json:"deposit_amount"`
	Status        string    `json:"status"`
	Category      Category  `json:"category"`
	CreatedAt     time.Time `json:"created_at"`
}

// ListingInput representa los datos necesarios para crear o actualizar un listing.
type ListingInput struct {
	Title         string   `json:"title"          binding:"required,max=120"`
	Description   string   `json:"description"    binding:"required"`
	Photos        []string `json:"photos"`
	DepositAmount float64  `json:"deposit_amount" binding:"required,gt=0"`
	Category      Category `json:"category"       binding:"required"`
	Status        string   `json:"status"`
}

// FilterParams representa los parámetros de filtrado para la consulta de listings.
type FilterParams struct {
	Category       Category
	Status         string
	Deposit        float64
	ExcludeOwnerID string
}
