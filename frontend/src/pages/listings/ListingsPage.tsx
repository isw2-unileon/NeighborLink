import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { listingsApi } from '../../lib/listings';
import { useAuth } from '../../contexts/AuthContext';
import type { Listing } from '../../types';

// Fórmula de Haversine — calcula la distancia en km entre dos coordenadas
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface Filters {
    search: string;
    category: string;
    depositMin: string;
    depositMax: string;
    status: string;
    maxDistanceKm: number; // 0 = sin límite
}

const INITIAL_FILTERS: Filters = {
    search: '',
    category: '',
    depositMin: '',
    depositMax: '',
    status: 'available',
    maxDistanceKm: 0,
};

export default function ListingsPage() {
    const { user } = useAuth();

    const [allListings, setAllListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
    const [depositMinInput, setDepositMinInput] = useState('');
    const [depositMaxInput, setDepositMaxInput] = useState('');


    const userLat = user?.lat ?? null;
    const userLon = user?.lon ?? null;



    useEffect(() => {
        setLoading(true);
        setError(null);

        listingsApi.getAll({
            category: filters.category || undefined,
            deposit_min: filters.depositMin || undefined,
            deposit_max: filters.depositMax || undefined,
            status: filters.status || undefined,
            exclude_owner_id: user?.id || undefined,
        })
            .then(setAllListings)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [filters.category, filters.depositMin, filters.depositMax, filters.status, user?.id]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setFilters(prev => ({
                ...prev,
                depositMin: depositMinInput,
                depositMax: depositMaxInput,
            }));
        }, 300);
        return () => window.clearTimeout(timeoutId);
    }, [depositMinInput, depositMaxInput]);

    const listings = useMemo(() => {
        let result = allListings;

        if (filters.search.trim()) {
            const q = filters.search.toLowerCase();
            result = result.filter(
                l =>
                    l.title.toLowerCase().includes(q) ||
                    l.description.toLowerCase().includes(q)
            );
        }

        if (filters.maxDistanceKm > 0 && userLat !== null && userLon !== null) {
            result = result.filter(l => {
                if (!l.owner_lat || !l.owner_lon) return true;
                return haversineKm(userLat, userLon, l.owner_lat, l.owner_lon) <= filters.maxDistanceKm;
            });
        }

        if (userLat !== null && userLon !== null) {
            result = [...result].sort((a, b) => {
                const distA = a.owner_lat && a.owner_lon
                    ? haversineKm(userLat, userLon, a.owner_lat, a.owner_lon)
                    : Infinity;
                const distB = b.owner_lat && b.owner_lon
                    ? haversineKm(userLat, userLon, b.owner_lat, b.owner_lon)
                    : Infinity;
                return distA - distB;
            });
        }

        return result;
    }, [allListings, filters.search, filters.maxDistanceKm, userLat, userLon]);

    function handleFilter(key: keyof Filters, value: string | number) {
        setFilters(prev => ({ ...prev, [key]: value }));
    }

    function handleResetFilters() {
        setFilters(INITIAL_FILTERS);
        setDepositMinInput('');
        setDepositMaxInput('');
    }

    if (loading) {
        return (
            <div className="flex min-h-64 items-center justify-center">
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
            <aside className="w-full shrink-0 lg:w-72">
                <div className="glass-panel flex flex-col gap-4 rounded-3xl p-6">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">
                        Filtros
                    </h2>

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

                    <div className="flex flex-col gap-3">
                        <label className="text-sm font-medium text-[var(--muted)]">Depósito</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                                <span className="text-xs text-[var(--muted)]">Mín.</span>
                                <input
                                    type="number"
                                    min={0}
                                    step={5}
                                    placeholder="Sin mínimo"
                                    value={depositMinInput}
                                    onChange={e => setDepositMinInput(e.target.value)}
                                    className="rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-xs text-[var(--muted)]">Máx.</span>
                                <input
                                    type="number"
                                    min={0}
                                    step={5}
                                    placeholder="Sin máximo"
                                    value={depositMaxInput}
                                    onChange={e => setDepositMaxInput(e.target.value)}
                                    className="rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                                />
                            </div>
                        </div>
                        <p className="text-sm text-[var(--muted)]">
                            {depositMinInput || depositMaxInput
                                ? `Depósito: ${depositMinInput || '0'} € - ${depositMaxInput || 'sin límite'} €`
                                : 'Todos los listings'}
                        </p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-[var(--muted)]">Estado</label>
                        <select
                            value={filters.status}
                            onChange={e => handleFilter('status', e.target.value)}
                            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm"
                        >
                            <option value="available">Disponible</option>
                            <option value="borrowed">Prestado</option>
                            <option value="inactive">Inactivo</option>
                        </select>
                    </div>

                    {/* Filtro de distancia — solo visible si el usuario tiene ubicación */}
                    {userLat !== null && userLon !== null && (
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-[var(--muted)]">
                                Distancia máxima
                                {filters.maxDistanceKm > 0
                                    ? `: ${filters.maxDistanceKm} km`
                                    : ': sin límite'}
                            </label>
                            <input
                                type="range"
                                min={0}
                                max={50}
                                step={1}
                                value={filters.maxDistanceKm}
                                onChange={e => handleFilter('maxDistanceKm', Number(e.target.value))}
                                className="w-full accent-[var(--accent-2)]"
                            />
                            <div className="flex justify-between text-xs text-[var(--muted)]">
                                <span>Sin límite</span>
                                <span>50 km</span>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleResetFilters}
                        className="text-left text-sm text-[var(--muted)] underline hover:text-[var(--text)]"
                    >
                        Limpiar filtros
                    </button>
                </div>
            </aside>

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
                    </div>

                    {listings.length === 0 ? (
                        <div className="py-16 text-center">
                            <p className="mb-3 text-4xl">🔍</p>
                            <p className="text-[var(--muted)]">No hay artículos disponibles todavía.</p>
                            <button
                                onClick={handleResetFilters}
                                className="mt-4 text-sm text-[var(--accent-2)] hover:underline"
                            >
                                Limpiar filtros
                            </button>
                        </div>
                    ) : (
                        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {listings.map(listing => {
                                const distKm =
                                    userLat !== null && userLon !== null && listing.owner_lat && listing.owner_lon
                                        ? haversineKm(userLat, userLon, listing.owner_lat, listing.owner_lon)
                                        : null;

                                return (
                                    <Link
                                        key={listing.id}
                                        to={`/listings/${listing.id}`}
                                        className="group flex flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-white transition hover:-translate-y-1 hover:shadow-lg"
                                    >
                                        {listing.photos?.length > 0 ? (
                                            <div className="aspect-square w-full overflow-hidden bg-[var(--surface-strong)]">
                                                <img
                                                    src={listing.photos[0]}
                                                    alt={listing.title}
                                                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex aspect-square w-full items-center justify-center bg-[var(--surface-strong)]">
                                                <span className="text-3xl">📦</span>
                                            </div>
                                        )}

                                        <div className="flex flex-1 flex-col gap-2 p-4">
                                            <h2 className="text-base font-semibold leading-tight">{listing.title}</h2>
                                            <p className="line-clamp-2 flex-1 text-xs text-[var(--muted)]">
                                                {listing.description}
                                            </p>
                                            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                                                {listing.category?.replace(/_/g, ' ')}
                                            </p>
                                            <p className="text-sm font-semibold text-[var(--accent-2)]">
                                                {listing.deposit_amount} € depósito
                                            </p>
                                            {distKm !== null && (
                                                <p className="text-xs text-[var(--muted)]">
                                                    📍 {distKm < 1
                                                        ? `${Math.round(distKm * 1000)} m de ti`
                                                        : `${distKm.toFixed(1)} km de ti`}
                                                </p>
                                            )}
                                            <span
                                                className={`mt-1 w-fit rounded-full px-3 py-1 text-xs font-semibold ${listing.status === 'available'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-orange-100 text-orange-700'
                                                    }`}
                                            >
                                                {listing.status === 'available' ? 'Disponible' : 'No disponible'}
                                            </span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}