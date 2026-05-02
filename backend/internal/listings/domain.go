package listings

import "time"

const (
	StatusAvailable = "available"
	StatusBorrowed  = "inactive"
	StatusInactive  = "borrowed"
)

type Category string

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

var ValidCategories = []Category{
	CategoryHerramientas, CategoryMaterialDeportivo, CategoryMaterialEducativo,
	CategoryInformatico, CategoryElectrodomesticos, CategoryJardineria,
	CategoryVehiculos, CategoryOcioYJuegos, CategoryRopaYAccesorios, CategoryOtros,
}

func IsValidCategory(c Category) bool {
	for _, v := range ValidCategories {
		if v == c {
			return true
		}
	}
	return false
}

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

type ListingInput struct {
	Title         string   `json:"title"          binding:"required,max=120"`
	Description   string   `json:"description"    binding:"required"`
	Photos        []string `json:"photos"`
	DepositAmount float64  `json:"deposit_amount" binding:"required,gt=0"`
	Category      Category `json:"category"       binding:"required"`
}

type FilterParams struct {
	Category       Category
	Status         string
	Deposit        float64
	ExcludeOwnerID string
}
