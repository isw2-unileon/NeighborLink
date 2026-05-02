import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listingsApi } from '../../lib/listings';
import { useAuth } from '../../contexts/AuthContext';
import type { Listing } from '../../types';

interface Coords { lat: number; lon: number; }

interface Filters {
    search: string;
    category: string;
    deposit: string;
    status: string;
}

const INITIAL_FILTERS: Filters = {
    search: '',
    category: '',
    deposit: '',
    status: '',
};

export default function ListingsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [allListings, setAllListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [coords, setCoords] = useState<Coords | null>(null);
    const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);

    useEffect(() => {
        if (!navigator.geolocation) {
            setCoords(null);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            pos => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            () => setCoords(null),
        );
    }, []);

    useEffect(() => {
        setLoading(true);
        setError(null);
        listingsApi.getAll({
            category: filters.category || undefined,
            deposit: filters.deposit || undefined,
            status: filters.status || undefined,
            //exclude_owner_id: user?.id || undefined, esto es para que no vea sus propios artículos en el apartado de listings
            lat: coords ? String(coords.lat) : undefined,
            lon: coords ? String(coords.lon) : undefined,
        })
            .then(setAllListings)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [filters.category, filters.deposit, filters.status, coords, user?.id]);

    const listings = useMemo(() => {
        if (!filters.search.trim()) return allListings;
        const q = filters.search.toLowerCase();
        return allListings.filter(l =>
            l.title.toLowerCase().includes(q) ||
            l.description.toLowerCase().includes(q)
        );
    }, [allListings, filters.search]);

    function handleFilter(key: keyof Filters, value: string) {
        setFilters(prev => ({ ...prev, [key]: value }));
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-64">
                <p className="text-gray-500">Cargando artículos...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <p className="text-red-600">Error: {error}</p>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full">

            {/* ── Panel de filtros lateral ── */}
            <aside className="w-52 shrink-0 flex flex-col gap-4 border-r border-gray-200 p-4 bg-white">
                <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Filtros</h2>

                {/* Búsqueda */}
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-600">Buscar</label>
                    <input
                        type="text"
                        placeholder="Nombre del artículo..."
                        value={filters.search}
                        onChange={e => handleFilter('search', e.target.value)}
                        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                </div>

                {/* Categoría */}
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-600">Categoría</label>
                    <select
                        value={filters.category}
                        onChange={e => handleFilter('category', e.target.value)}
                        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    >
                        <option value="">Todas</option>
                        <option value="herramientas">Herramientas</option>
                        <option value="material_deportivo">Material deportivo</option>
                        <option value="material_educativo">Material educativo</option>
                        <option value="informatico">Informático</option>
                        <option value="electrodomesticos">Electrodomésticos</option>
                        <option value="jardineria">Jardinería</option>
                        <option value="vehiculos">Vehículos</option>
                        <option value="ocio_y_juegos">Ocio y juegos</option>
                        <option value="ropa_y_accesorios">Ropa y accesorios</option>
                        <option value="otros">Otros</option>
                    </select>
                </div>

                {/* Depósito máximo */}
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-600">
                        Depósito máx:{' '}
                        <span className="text-teal-700 font-semibold">
                            {filters.deposit ? `${filters.deposit} €` : 'Sin límite'}
                        </span>
                    </label>
                    <input
                        type="range"
                        min={20} max={200} step={10}
                        value={filters.deposit || 200}
                        onChange={e => handleFilter('deposit', e.target.value === '200' ? '' : e.target.value)}
                        className="w-full accent-teal-700"
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                        <span>20 €</span><span>+200 €</span>
                    </div>
                </div>

                {/* Estado */}
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-600">Estado</label>
                    <select
                        value={filters.status}
                        onChange={e => handleFilter('status', e.target.value)}
                        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    >
                        <option value="">Todos</option>
                        <option value="available">Disponible</option>
                        <option value="borrowed">Prestado</option>
                        <option value="inactive">Inactivo</option>
                    </select>
                </div>

                {!coords && (
                    <p className="text-xs text-gray-400 italic">
                        Activa la ubicación para filtrar por distancia.
                    </p>
                )}

                <button
                    onClick={() => setFilters(INITIAL_FILTERS)}
                    className="text-sm text-gray-500 hover:text-gray-700 underline text-left"
                >
                    Limpiar filtros
                </button>
            </aside>

            {/* ── Contenido principal ── */}
            <div className="flex-1 px-6 py-6">
                <div className="flex justify-between items-center mb-5">
                    <h1 className="text-xl font-bold">
                        Explorar artículos
                        {listings.length > 0 && (
                            <span className="ml-2 text-sm font-normal text-gray-400">
                                ({listings.length} resultado{listings.length !== 1 ? 's' : ''})
                            </span>
                        )}
                    </h1>
                    {user && (
                        <button
                            onClick={() => navigate('/listings/new')}
                            className="bg-teal-700 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-teal-800"
                        >
                            + Publicar artículo
                        </button>
                    )}
                </div>

                {listings.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-4xl mb-3">🔍</p>
                        <p className="text-gray-500">No hay artículos disponibles todavía.</p>
                        <button
                            onClick={() => setFilters(INITIAL_FILTERS)}
                            className="mt-4 text-teal-700 hover:underline text-sm"
                        >
                            Limpiar filtros
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                        {listings.map(listing => (
                            <Link
                                key={listing.id}
                                to={`/listings/${listing.id}`}
                                className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white flex flex-col"
                            >
                                {/* Imagen cuadrada — más compacta que aspect-video */}
                                {listing.photos?.length > 0 ? (
                                    <div className="w-full aspect-square overflow-hidden bg-gray-100">
                                        <img
                                            src={listing.photos[0]}
                                            alt={listing.title}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-full aspect-square bg-gray-100 flex items-center justify-center">
                                        <span className="text-2xl">📦</span>
                                    </div>
                                )}

                                <div className="p-2 flex flex-col flex-1">
                                    <h2 className="font-semibold text-sm leading-tight">{listing.title}</h2>
                                    <p className="text-gray-500 text-xs mt-1 line-clamp-2 flex-1">
                                        {listing.description}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1 capitalize">
                                        {listing.category?.replace(/_/g, ' ')}
                                    </p>
                                    <p className="text-teal-700 font-semibold text-sm mt-1">
                                        {listing.deposit_amount} € depósito
                                    </p>
                                    <span className={`mt-1 self-start text-xs px-2 py-0.5 rounded-full font-medium ${listing.status === 'available'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-orange-100 text-orange-700'
                                        }`}>
                                        {listing.status === 'available' ? 'Disponible' : 'No disponible'}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}