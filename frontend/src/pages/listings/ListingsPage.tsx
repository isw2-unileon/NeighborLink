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
            <div className="rounded-2xl bg-white px-6 py-6 shadow-sm">
                <p className="text-red-600">Error: {error}</p>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-6 lg:flex-row">
            {/* ── Panel de filtros lateral ── */}
            <aside className="w-full shrink-0 lg:w-72">
                <div className="glass-panel rounded-3xl p-6 flex flex-col gap-4">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">Filtros</h2>

                    {/* Búsqueda */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-[var(--muted)]">Buscar</label>
                        <input
                            type="text"
                            placeholder="Nombre del artículo..."
                            value={filters.search}
                            onChange={e => handleFilter('search', e.target.value)}
                            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                        />
                    </div>

                    {/* Categoría */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-[var(--muted)]">Categoría</label>
                        <select
                            value={filters.category}
                            onChange={e => handleFilter('category', e.target.value)}
                            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm"
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
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-[var(--muted)]">
                            Depósito máx:{' '}
                            <span className="text-[var(--accent-2)] font-semibold">
                                {filters.deposit ? `${filters.deposit} €` : 'Sin límite'}
                            </span>
                        </label>
                        <input
                            type="range"
                            min={20} max={200} step={10}
                            value={filters.deposit || 200}
                            onChange={e => handleFilter('deposit', e.target.value === '200' ? '' : e.target.value)}
                            className="w-full accent-[var(--accent-2)]"
                        />
                        <div className="flex justify-between text-xs text-[var(--muted)]">
                            <span>20 €</span><span>+200 €</span>
                        </div>
                    </div>

                    {/* Estado */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-[var(--muted)]">Estado</label>
                        <select
                            value={filters.status}
                            onChange={e => handleFilter('status', e.target.value)}
                            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm"
                        >
                            <option value="">Todos</option>
                            <option value="available">Disponible</option>
                            <option value="borrowed">Prestado</option>
                            <option value="inactive">Inactivo</option>
                        </select>
                    </div>

                    {!coords && (
                        <p className="text-xs text-[var(--muted)] italic">
                            Activa la ubicación para filtrar por distancia.
                        </p>
                    )}

                    <button
                        onClick={() => setFilters(INITIAL_FILTERS)}
                        className="text-sm text-[var(--muted)] hover:text-[var(--text)] underline text-left"
                    >
                        Limpiar filtros
                    </button>
                </div>
            </aside>

            {/* ── Contenido principal ── */}
            <div className="flex-1">
                <div className="glass-panel rounded-3xl px-6 py-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <h1 className="text-2xl font-semibold">
                            Explorar artículos
                            {listings.length > 0 && (
                                <span className="ml-2 text-sm font-normal text-[var(--muted)]">
                                    ({listings.length} resultado{listings.length !== 1 ? 's' : ''})
                                </span>
                            )}
                        </h1>
                        {user && (
                            <button
                                onClick={() => navigate('/listings/new')}
                                className="rounded-full bg-[var(--accent-2)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-95"
                            >
                                + Publicar artículo
                            </button>
                        )}
                    </div>

                    {listings.length === 0 ? (
                        <div className="text-center py-16">
                            <p className="text-4xl mb-3">🔍</p>
                            <p className="text-[var(--muted)]">No hay artículos disponibles todavía.</p>
                            <button
                                onClick={() => setFilters(INITIAL_FILTERS)}
                                className="mt-4 text-[var(--accent-2)] hover:underline text-sm"
                            >
                                Limpiar filtros
                            </button>
                        </div>
                    ) : (
                        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {listings.map(listing => (
                                <Link
                                    key={listing.id}
                                    to={`/listings/${listing.id}`}
                                    className="group flex flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-white transition hover:-translate-y-1 hover:shadow-lg"
                                >
                                    {listing.photos?.length > 0 ? (
                                        <div className="w-full aspect-square overflow-hidden bg-[var(--surface-strong)]">
                                            <img
                                                src={listing.photos[0]}
                                                alt={listing.title}
                                                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex w-full aspect-square items-center justify-center bg-[var(--surface-strong)]">
                                            <span className="text-3xl">📦</span>
                                        </div>
                                    )}

                                    <div className="flex flex-1 flex-col gap-2 p-4">
                                        <h2 className="text-base font-semibold leading-tight">{listing.title}</h2>
                                        <p className="text-xs text-[var(--muted)] line-clamp-2 flex-1">
                                            {listing.description}
                                        </p>
                                        <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                                            {listing.category?.replace(/_/g, ' ')}
                                        </p>
                                        <p className="text-[var(--accent-2)] font-semibold text-sm">
                                            {listing.deposit_amount} € depósito
                                        </p>
                                        <span className={`mt-1 w-fit rounded-full px-3 py-1 text-xs font-semibold ${listing.status === 'available'
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
        </div>
    );
}