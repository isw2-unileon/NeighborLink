import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usersApi } from '../lib/users';
import { listingsApi } from '../lib/listings';
import { walletApi } from '../lib/wallet';
import type { Listing, PointsHistoryEntry } from '../types';
import { reservationsApi } from '../lib/reservations';
import type { Transaction } from '../types';


// ── Helpers ──────────────────────────────────────────────────────────────────


const STATUS_LABELS: Record<string, string> = {
    available: 'Disponibles',
    pending_handover: 'Pendiente de entrega',
    pending_return: 'Pendiente de devolución',
};

const STATUS_COLORS: Record<string, string> = {
    available: 'bg-green-100 text-green-700',
    pending_handover: 'bg-yellow-100 text-yellow-700',
    pending_return: 'bg-blue-100 text-blue-700',
};

const RESERVATION_STATUS_LABELS: Record<string, string> = {
    pending: 'Pendiente de confirmación',
    agreed: 'Pendiente de entrega',
    handed_over: 'Pendiente de devolución',
    returned: 'Completada',
    rejected: 'Rechazada',
};

const RESERVATION_STATUS_COLORS: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    agreed: 'bg-blue-100 text-blue-700',
    handed_over: 'bg-purple-100 text-purple-700',
    returned: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
};

const VISIBLE_STATUSES = ['available', 'pending_handover', 'pending_return'];

const EMPTY_MESSAGES: Record<string, string> = {
    available: 'No tienes objetos disponibles en este momento.',
    pending_handover: 'No tienes objetos pendientes de entregar en este momento.',
    pending_return: 'No tienes objetos pendientes de devolver en este momento.',
};

function getListingTo(listing: Listing): string {
    if (listing.status === 'pending_handover') return `/listings/${listing.id}/handover`;
    if (listing.status === 'pending_return') return `/listings/${listing.id}/return`;
    return `/listings/${listing.id}`;
}

function MyListings({ userID }: { userID: string }) {
    const [listings, setListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        listingsApi.getByOwner(userID)
            .then(setListings)
            .catch(() => setError('No se pudieron cargar tus objetos'))
            .finally(() => setLoading(false));
    }, [userID]);

    const grouped = VISIBLE_STATUSES.reduce<Record<string, Listing[]>>((acc, status) => {
        acc[status] = listings.filter(l => l.status === status);
        return acc;
    }, {});

    return (
        <div className="glass-panel rounded-3xl p-6 flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-[var(--text)]">Mis objetos</h2>
                <Link to="/listings/new"
                    className="text-sm font-medium text-[var(--accent-2)] border border-[var(--accent-2)]/20 rounded-full px-4 py-2 hover:bg-[var(--surface-strong)] transition">
                    + Publicar objeto
                </Link>
            </div>

            {loading && (
                <p className="text-sm text-[var(--muted)] text-center">Cargando tus objetos…</p>
            )}
            {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            {!loading && !error && VISIBLE_STATUSES.map(status => {
                const items = grouped[status] ?? [];
                return (
                    <div key={status} className="flex flex-col gap-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                            {STATUS_LABELS[status]}
                        </h3>
                        {items.length === 0 ? (
                            <p className="text-sm text-[var(--muted)] py-2">{EMPTY_MESSAGES[status]}</p>
                        ) : (
                            items.map(listing => (
                                <Link key={listing.id} to={getListingTo(listing)}
                                    className="flex items-center gap-4 rounded-2xl px-3 py-3 transition hover:bg-white/80">
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
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[status]}`}>
                                        {STATUS_LABELS[status]}
                                    </span>
                                </Link>
                            ))
                        )}
                    </div>
                );
            })}
        </div>
    );
}


// ── WalletTab ─────────────────────────────────────────────────────────────────


function WalletTab({ points, onRedeem }: { points: number; onRedeem: () => void }) {
    const [history, setHistory] = useState<PointsHistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [redeeming, setRedeeming] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        walletApi.getPointsHistory()
            .then(setHistory)
            .catch(() => setError('No se pudo cargar el historial'))
            .finally(() => setLoading(false));
    }, []);

    async function handleRedeem() {
        setRedeeming(true);
        setError(null);
        try {
            await walletApi.redeemPoints();
            onRedeem();
            setSuccess('Solicitud de cobro enviada. El pago se procesará en breve.');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al canjear puntos');
        } finally {
            setRedeeming(false);
        }
    }

    const displayPoints = (points / 100).toFixed(2);
    const canRedeem = points >= 1000;

    return (
        <div className="glass-panel rounded-3xl p-6 flex flex-col gap-6">
            <div>
                <h2 className="text-base font-semibold text-[var(--text)] mb-4">Mi cartera</h2>
                <div className="flex items-center justify-between bg-[var(--surface-strong)] border border-[var(--border)] rounded-2xl px-5 py-4">
                    <div>
                        <p className="text-2xl font-bold text-[var(--accent-2)]">{displayPoints} puntos</p>
                        <p className="text-sm text-[var(--muted)] mt-0.5">{displayPoints} €</p>
                    </div>
                    <button
                        onClick={handleRedeem}
                        disabled={!canRedeem || redeeming}
                        className="text-sm font-semibold px-4 py-2 rounded-full border transition disabled:opacity-40 disabled:cursor-not-allowed bg-[var(--accent-2)] text-white border-[var(--accent-2)] hover:brightness-95"
                    >
                        {redeeming ? 'Procesando…' : 'Canjear puntos'}
                    </button>
                </div>
                {!canRedeem && (
                    <p className="text-xs text-[var(--muted)] mt-2">
                        Necesitas al menos 10,00 puntos para canjear.
                    </p>
                )}
                {success && (
                    <p className="mt-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                        ✓ {success}
                    </p>
                )}
                {error && (
                    <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {error}
                    </p>
                )}
            </div>

            <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-3">
                    Historial de préstamos completados
                </h3>
                {loading && <p className="text-sm text-[var(--muted)]">Cargando historial…</p>}
                {!loading && history.length === 0 && (
                    <p className="text-sm text-[var(--muted)] py-2">Aún no tienes préstamos completados.</p>
                )}
                {!loading && history.map(entry => (
                    <div key={entry.transaction_id}
                        className="flex items-center justify-between py-3 border-t border-[var(--border)] first:border-0">
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--text)] truncate">{entry.listing_title}</p>
                            <p className="text-xs text-[var(--muted)] mt-0.5">
                                {new Date(entry.completed_at).toLocaleDateString('es-ES')}
                            </p>
                        </div>
                        <span className="text-sm font-semibold text-[var(--accent-2)] ml-4 flex-shrink-0">
                            +{(entry.points_earned / 100).toFixed(2)} pts
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}


function MyReservations({ userID }: { userID: string }) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        reservationsApi.getMyBorrowedTransactions(userID)
            .then(setTransactions)
            .catch(() => setError('No se pudieron cargar tus reservas'))
            .finally(() => setLoading(false));
    }, [userID]);

    const active = transactions.filter(t => ['pending', 'agreed', 'handed_over'].includes(t.status));
    const past = transactions.filter(t => ['returned', 'rejected'].includes(t.status));

    return (
        <div className="glass-panel rounded-3xl p-6 flex flex-col gap-6">
            <h2 className="text-base font-semibold text-[var(--text)]">Mis reservas</h2>

            {loading && <p className="text-sm text-[var(--muted)] text-center">Cargando reservas…</p>}
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}

            {!loading && !error && (
                <>
                    <div className="flex flex-col gap-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Activas</h3>
                        {active.length === 0
                            ? <p className="text-sm text-[var(--muted)] py-2">No tienes reservas activas.</p>
                            : active.map(t => (
                                <Link key={t.id}
                                    to={t.status === 'agreed' ? `/reservations/${t.id}/handover` : t.status === 'handed_over' ? `/reservations/${t.id}/return` : '#'}
                                    className="flex items-center gap-4 rounded-2xl px-3 py-3 transition hover:bg-white/80">
                                    <div className="w-14 h-14 rounded-xl bg-[var(--surface-strong)] flex-shrink-0 overflow-hidden">
                                        {t.listing_photo
                                            ? <img src={t.listing_photo} alt={t.listing_title ?? ''} className="w-full h-full object-cover" />
                                            : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl">📦</div>
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-[var(--text)] truncate">{t.listing_title ?? t.listing_id}</p>
                                        <p className="text-xs text-[var(--muted)] mt-0.5">
                                            {t.start_date && t.end_date
                                                ? `${new Date(t.start_date).toLocaleDateString('es-ES')} – ${new Date(t.end_date).toLocaleDateString('es-ES')}`
                                                : 'Sin fechas'}
                                        </p>
                                    </div>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RESERVATION_STATUS_COLORS[t.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                        {RESERVATION_STATUS_LABELS[t.status] ?? t.status}
                                    </span>
                                </Link>
                            ))
                        }
                    </div>
                    <div className="flex flex-col gap-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Historial</h3>
                        {past.length === 0
                            ? <p className="text-sm text-[var(--muted)] py-2">Aún no tienes reservas completadas.</p>
                            : past.map(t => (
                                <div key={t.id} className="flex items-center gap-4 rounded-2xl px-3 py-3">
                                    <div className="w-14 h-14 rounded-xl bg-[var(--surface-strong)] flex-shrink-0 overflow-hidden">
                                        {t.listing_photo
                                            ? <img src={t.listing_photo} alt={t.listing_title ?? ''} className="w-full h-full object-cover" />
                                            : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl">📦</div>
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-[var(--text)] truncate">{t.listing_title ?? t.listing_id}</p>
                                        <p className="text-xs text-[var(--muted)] mt-0.5">
                                            {t.return_at ? new Date(t.return_at).toLocaleDateString('es-ES') : ''}
                                        </p>
                                    </div>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RESERVATION_STATUS_COLORS[t.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                        {RESERVATION_STATUS_LABELS[t.status] ?? t.status}
                                    </span>
                                </div>
                            ))
                        }
                    </div>
                </>
            )}
        </div>
    );
}

// ── ProfilePage ───────────────────────────────────────────────────────────────


export default function ProfilePage() {
    const { user, token, updateUser } = useAuth();
    const navigate = useNavigate();

    const [tab, setTab] = useState<'listings' | 'reservations' | 'wallet'>('listings');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!user || !token) return null;

    async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setError(null);
        try {
            const updated = await usersApi.uploadAvatar(file);
            updateUser(updated);
            setSuccess('Avatar actualizado');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al subir el avatar');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
            <div className="glass-panel rounded-3xl p-8">
                <div className="flex flex-col gap-6 md:flex-row md:items-center">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                        {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.name}
                                className="w-24 h-24 rounded-full object-cover border-2 border-white" />
                        ) : (
                            <div className="w-24 h-24 rounded-full bg-[var(--surface-strong)] flex items-center justify-center text-3xl font-bold text-[var(--accent-2)]">
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <button type="button" disabled={uploading}
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-white border border-[var(--border)] shadow flex items-center justify-center text-[var(--muted)] hover:text-[var(--accent-2)] transition disabled:opacity-50"
                            title="Cambiar foto">
                            {uploading ? '…' : '📷'}
                        </button>
                        <input ref={fileInputRef} type="file" accept="image/*"
                            className="hidden" onChange={handleAvatarChange} />
                    </div>

                    {/* Datos */}
                    <div className="flex-1 min-w-0">
                        <h1 className="font-editorial text-3xl font-semibold truncate">{user.name}</h1>
                        <p className="text-sm text-[var(--muted)] mt-0.5">{user.email}</p>
                        {user.address && (
                            <p className="text-sm text-[var(--muted)] mt-1">
                                📍 {user.address.replace(', España', '')}
                            </p>
                        )}
                    </div>

                    <button onClick={() => navigate('/profile/edit')}
                        className="flex-shrink-0 text-sm font-semibold text-[var(--accent-2)] border border-[var(--accent-2)]/20 rounded-full px-4 py-2 hover:bg-[var(--surface-strong)] transition">
                        Editar perfil
                    </button>
                </div>

                {success && (
                    <p className="mt-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                        ✓ {success}
                    </p>
                )}
                {error && (
                    <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {error}
                    </p>
                )}
            </div>

            <div className="flex flex-wrap gap-2">
                {(['listings', 'reservations', 'wallet'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === t
                            ? 'bg-[var(--accent-2)] text-white'
                            : 'bg-white text-[var(--muted)] hover:text-[var(--text)]'
                            }`}
                    >
                        {t === 'listings' ? 'Mis Objetos' : t === 'reservations' ? 'Mis Reservas' : 'Cartera'}
                    </button>
                ))}
            </div>

            {tab === 'listings' && <MyListings userID={user.id} />}
            {tab === 'reservations' && <MyReservations userID={user.id} />}
            {tab === 'wallet' && (
                <WalletTab
                    points={user.points ?? 0}
                    onRedeem={() => updateUser({ ...user, points: 0 })}
                />
            )}
        </div>
    );
}