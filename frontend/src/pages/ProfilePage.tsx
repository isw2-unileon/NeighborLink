import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usersApi } from '../lib/users';
import { listingsApi } from '../lib/listings';
import type { Listing } from '../types';


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
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Mis objetos</h2>
                <Link to="/listings/new"
                    className="text-sm font-medium text-teal-700 border border-teal-200 rounded-lg px-4 py-2 hover:bg-teal-50 transition">
                    + Publicar objeto
                </Link>
            </div>

            {loading && (
                <p className="text-sm text-gray-400 text-center">Cargando tus objetos…</p>
            )}
            {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            {!loading && !error && VISIBLE_STATUSES.map(status => {
                const items = grouped[status] ?? [];
                return (
                    <div key={status} className="flex flex-col gap-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            {STATUS_LABELS[status]}
                        </h3>
                        {items.length === 0 ? (
                            <p className="text-sm text-gray-400 py-2">{EMPTY_MESSAGES[status]}</p>
                        ) : (
                            items.map(listing => (
                                <Link key={listing.id} to={getListingTo(listing)}
                                    className="flex items-center gap-4 py-3 border-t border-gray-100 first:border-0 hover:bg-gray-50 rounded-lg px-2 transition">
                                    <div className="w-14 h-14 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                                        {listing.photos?.[0]
                                            ? <img src={listing.photos[0]} alt={listing.title} className="w-full h-full object-cover" />
                                            : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl">📦</div>
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{listing.title}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">Depósito: {listing.deposit_amount}€</p>
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


// ── ProfilePage ───────────────────────────────────────────────────────────────


export default function ProfilePage() {
    const { user, token, updateUser } = useAuth();
    const navigate = useNavigate();

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
        <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
                <div className="flex items-center gap-6">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                        {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.name}
                                className="w-24 h-24 rounded-full object-cover border-2 border-gray-100" />
                        ) : (
                            <div className="w-24 h-24 rounded-full bg-teal-100 flex items-center justify-center text-3xl font-bold text-teal-700">
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <button type="button" disabled={uploading}
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center text-gray-500 hover:text-teal-700 hover:border-teal-400 transition disabled:opacity-50"
                            title="Cambiar foto">
                            {uploading ? '…' : '📷'}
                        </button>
                        <input ref={fileInputRef} type="file" accept="image/*"
                            className="hidden" onChange={handleAvatarChange} />
                    </div>

                    {/* Datos */}
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl font-bold text-gray-900 truncate">{user.name}</h1>
                        <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
                        {user.address && (
                            <p className="text-sm text-gray-500 mt-1">
                                📍 {user.address.replace(', España', '')}
                            </p>
                        )}
                    </div>

                    <button onClick={() => navigate('/profile/edit')}
                        className="flex-shrink-0 text-sm font-medium text-teal-700 border border-teal-200 rounded-lg px-4 py-2 hover:bg-teal-50 transition">
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

            <MyListings userID={user.id} />
        </div>
    );
}