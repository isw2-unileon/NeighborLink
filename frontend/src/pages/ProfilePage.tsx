import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usersApi } from '../lib/users';
import { listingsApi } from '../lib/listings';
import type { Listing } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

    if (loading) return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center text-gray-400 text-sm">
            Cargando tus objetos…
        </div>
    );
    if (error) return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center text-red-500 text-sm">
            {error}
        </div>
    );
    if (listings.length === 0) return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <p className="text-gray-400 text-sm">Aún no tienes objetos publicados.</p>
            <a href="/listings/new" className="mt-3 inline-block text-sm font-medium text-teal-700 hover:underline">
                Publica tu primer objeto →
            </a>
        </div>
    );

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-700">Tus objetos</h2>
            {listings.map(listing => (
                <a key={listing.id} href={`/listings/${listing.id}`}
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
                    <span className="text-xs text-gray-400">→</span>
                </a>
            ))}
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