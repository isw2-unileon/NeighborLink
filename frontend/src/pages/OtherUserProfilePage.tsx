import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usersApi } from '../lib/users';
import { listingsApi } from '../lib/listings';
import type { User, Listing } from '../types';

// ── Reutilizamos los mismos helpers visuales que ProfilePage ──────────────────

const STATUS_LABELS: Record<string, string> = {
    available: 'Disponible',
    pending_handover: 'No disponible',
    pending_return: 'No disponible',
    borrowed: 'No disponible',
    inactive: 'No disponible',
};

const STATUS_COLORS: Record<string, string> = {
    available: 'bg-green-100 text-green-700',
    pending_handover: 'bg-red-100 text-red-600',
    pending_return: 'bg-red-100 text-red-600',
    borrowed: 'bg-red-100 text-red-600',
    inactive: 'bg-red-100 text-red-600',
};

// Solo mostramos grupos públicamente relevantes (no 'inactive')
const PUBLIC_STATUS_GROUPS = [
    { label: 'Disponibles', statuses: ['available'], empty: 'No tiene objetos disponibles.' },
    { label: 'No disponibles', statuses: ['pending_handover', 'pending_return', 'borrowed'], empty: null },
];

// ── Componente principal ──────────────────────────────────────────────────────

export default function OtherUserProfilePage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [profileUser, setProfileUser] = useState<User | null>(null);
    const [listings, setListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        Promise.all([
            usersApi.getUser(id),
            listingsApi.getByOwner(id),
        ])
            .then(([user, userListings]) => {
                setProfileUser(user);
                setListings(userListings);
            })
            .catch(() => setError('No se pudo cargar el perfil'))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8">
                <p className="text-sm text-[var(--muted)] text-center">Cargando perfil…</p>
            </div>
        );
    }

    if (error || !profileUser) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8">
                <p className="text-sm text-red-500 text-center">{error ?? 'Usuario no encontrado'}</p>
            </div>
        );
    }

    const availableCount = listings.filter(l => l.status === 'available').length;
    const totalCount = listings.filter(l => l.status !== 'inactive').length;

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">

            {/* ── Header ── */}
            <div className="glass-panel rounded-3xl p-8">
                <button
                    onClick={() => navigate(-1)}
                    className="text-sm text-[var(--muted)] hover:text-[var(--text)] transition mb-6 flex items-center gap-1"
                >
                    ← Volver
                </button>

                <div className="flex flex-col gap-6 md:flex-row md:items-center">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                        {profileUser.avatar_url ? (
                            <img
                                src={profileUser.avatar_url}
                                alt={profileUser.name}
                                className="w-24 h-24 rounded-full object-cover border-2 border-white shadow-md"
                            />
                        ) : (
                            <div className="w-24 h-24 rounded-full bg-[var(--surface-strong)] flex items-center justify-center text-3xl font-bold text-[var(--accent-2)]">
                                {profileUser.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>

                    {/* Datos */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <h1 className="font-editorial text-3xl font-semibold truncate">{profileUser.name}</h1>
                        {typeof profileUser.reputation_score === 'number' && (
                            <div className="flex items-center gap-1 mt-1">
                                <span className="text-yellow-400 text-sm">★</span>
                                <span className="text-sm font-medium text-[var(--text)]">
                                    {profileUser.reputation_score > 0
                                        ? profileUser.reputation_score.toFixed(1)
                                        : 'Sin valoraciones aún'}
                                </span>
                            </div>
                        )}
                        <p className="text-xs text-[var(--muted)] mt-1">
                            {totalCount} objeto{totalCount !== 1 ? 's' : ''} publicados
                        </p>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-3 flex-shrink-0">
                        <div className="flex flex-col items-center bg-[var(--accent-2)]/10 border border-[var(--accent-2)]/20 rounded-2xl px-5 py-4 min-w-[90px]">
                            <span className="text-2xl font-bold text-[var(--accent-2)]">{availableCount}</span>
                            <span className="text-xs text-[var(--accent-2)]/70 font-medium mt-0.5">disponibles</span>
                        </div>
                        <div className="flex flex-col items-center bg-[var(--surface-strong)] border border-[var(--border)] rounded-2xl px-5 py-4 min-w-[90px]">
                            <span className="text-2xl font-bold text-[var(--text)]">{totalCount - availableCount}</span>
                            <span className="text-xs text-[var(--muted)] font-medium mt-0.5">no disponibles</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Objetos agrupados por estado ── */}
            <div className="glass-panel rounded-3xl p-6 flex flex-col gap-6">
                <h2 className="text-base font-semibold text-[var(--text)]">Objetos de {profileUser.name}</h2>

                {listings.length === 0 ? (
                    <p className="text-sm text-[var(--muted)] py-2">Este usuario no tiene objetos publicados.</p>
                ) : (
                    PUBLIC_STATUS_GROUPS.map(group => {
                        const items = listings.filter(l => group.statuses.includes(l.status));
                        // Ocultamos grupos vacíos salvo "Disponibles"
                        if (items.length === 0 && group.empty === null) return null;
                        return (
                            <div key={group.label} className="flex flex-col gap-2">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                                    {group.label}
                                </h3>
                                {items.length === 0 ? (
                                    <p className="text-sm text-[var(--muted)] py-2">{group.empty}</p>
                                ) : (
                                    items.map(listing => (
                                        <button
                                            key={listing.id}
                                            onClick={() => navigate(`/listings/${listing.id}`)}
                                            className="flex items-center gap-4 rounded-2xl px-3 py-3 transition hover:bg-white/80 text-left w-full"
                                        >
                                            <div className="w-14 h-14 rounded-xl bg-[var(--surface-strong)] flex-shrink-0 overflow-hidden">
                                                {listing.photos?.[0]
                                                    ? <img src={listing.photos[0]} alt={listing.title} className="w-full h-full object-cover" />
                                                    : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl">📦</div>
                                                }
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-[var(--text)] truncate">{listing.title}</p>
                                                <p className="text-xs text-[var(--muted)] mt-0.5">Depósito: {listing.deposit_amount}€</p>
                                            </div>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[listing.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                                {STATUS_LABELS[listing.status] ?? listing.status}
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}