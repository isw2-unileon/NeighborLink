import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listingsApi } from '../../lib/listings';
import { transactionsApi } from '../../lib/transactions';
import { useAuth } from '../../contexts/AuthContext';
import type { Listing, Transaction } from '../../types';
import ReserveModal from '../../components/ReserveModal';
import Toast from '../../components/Toast';

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendiente de confirmación',
    agreed: 'Pendiente de entrega',
    handed_over: 'Pendiente de devolución',
    returned: 'Completada',
    cancelled: 'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    agreed: 'bg-blue-100 text-blue-700',
    handed_over: 'bg-purple-100 text-purple-700',
    returned: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
};

const LISTING_STATUS_LABELS: Record<string, string> = {
    available: 'Disponible',
    pending_handover: 'Reservado (pendiente de entrega)',
    pending_return: 'Prestado (pendiente de devolución)',
    borrowed: 'Prestado',
    inactive: 'Inactivo',
};

const LISTING_STATUS_COLORS: Record<string, string> = {
    available: 'bg-green-100 text-green-700',
    pending_handover: 'bg-orange-100 text-orange-700',
    pending_return: 'bg-yellow-100 text-yellow-700',
    borrowed: 'bg-yellow-100 text-yellow-700',
    inactive: 'bg-gray-100 text-gray-600',
};

interface ListingInput {
    title: string;
    description: string;
    photos: string[];
    deposit_amount: number;
    category: string;
    status: string;
}

// --- Componente carrusel aislado (SRP) ---
function PhotoCarousel({ photos, alt }: { photos: string[]; alt: string }) {
    const [current, setCurrent] = useState(0);

    if (photos.length === 0) return null;

    const prev = () => setCurrent(i => (i - 1 + photos.length) % photos.length);
    const next = () => setCurrent(i => (i + 1) % photos.length);

    return (
        <div className="relative w-full mb-6 select-none">
            {/* Imagen principal */}
            <img
                src={photos[current]}
                alt={`${alt} - foto ${current + 1}`}
                className="w-full max-h-96 object-contain rounded-3xl bg-[var(--surface-strong)]"
            />

            {/* Flechas — solo si hay más de una foto */}
            {photos.length > 1 && (
                <>
                    <button
                        onClick={prev}
                        aria-label="Foto anterior"
                        className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow rounded-full w-9 h-9 flex items-center justify-center text-gray-700 transition"
                    >
                        ←
                    </button>
                    <button
                        onClick={next}
                        aria-label="Foto siguiente"
                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow rounded-full w-9 h-9 flex items-center justify-center text-gray-700 transition"
                    >
                        →
                    </button>

                    {/* Indicador de puntos */}
                    <div className="flex justify-center gap-1.5 mt-2">
                        {photos.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrent(i)}
                                aria-label={`Ir a foto ${i + 1}`}
                                className={`w-2 h-2 rounded-full transition-colors ${i === current ? 'bg-[var(--accent)]' : 'bg-gray-300'
                                    }`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// --- Página principal ---
export default function ListingDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [listing, setListing] = useState<Listing | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [form, setForm] = useState<ListingInput>({
        title: '',
        description: '',
        photos: [],
        deposit_amount: 0,
        category: '',
        status: 'available',
    });

    const [showReserve, setShowReserve] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [activeTransaction, setActiveTransaction] = useState<Transaction | null>(null);

    const isOwner = user?.id === listing?.owner_id;

    useEffect(() => {
        if (!id) return;
        listingsApi.getById(id)
            .then(data => {
                setListing(data);
                setForm({
                    title: data.title,
                    description: data.description,
                    photos: data.photos ?? [],
                    deposit_amount: data.deposit_amount,
                    category: data.category ?? 'otros',
                    status: data.status ?? 'available',
                });
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [id]);

    async function handleUpdate(e: React.FormEvent) {
        e.preventDefault();
        if (!id) return;
        setSaving(true);
        try {
            const updated = await listingsApi.update(id, form);
            setListing(updated);
            setEditing(false);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al guardar');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!id || !confirm('¿Seguro que quieres borrar este artículo?')) return;
        try {
            await listingsApi.delete(id);
            navigate('/listings');
        } catch (err: any) {
            if (err.response?.data?.code === 'ACTIVE_TRANSACTIONS_EXIST') {
                setToast(err.response.data.details);
            } else {
                setError(err.response?.data?.error || err.message || 'Error al borrar');
            }
        }
    }

    async function handleAdminDelete() {
        if (!id) return;
        const reason = window.prompt('Por favor, indica la razón del borrado (se le notificará al usuario):', 'Incumplimiento de las normas de la comunidad.');
        if (reason === null) return; // Cancelado

        if (!confirm('¿Seguro que quieres borrar este artículo como administrador?')) return;

        try {
            await listingsApi.deleteAsAdmin(id, reason);
            navigate('/listings');
        } catch (err: any) {
            if (err.response?.data?.code === 'ACTIVE_TRANSACTIONS_EXIST') {
                setToast(err.response.data.details);
            } else {
                setError(err.response?.data?.error || err.message || 'Error al borrar como administrador');
            }
        }
    }

    async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !id) return;
        setUploading(true);
        try {
            const updated = await listingsApi.uploadPhoto(id, file);
            setListing(updated);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al subir foto');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-64">
                <p className="text-gray-500">Cargando...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-2xl mx-auto p-6">
                <p className="text-red-600">Error: {error}</p>
            </div>
        );
    }

    if (!listing) {
        return (
            <div className="max-w-2xl mx-auto p-6">
                <p className="text-gray-500">Artículo no encontrado.</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto px-4 py-8">
            {!editing ? (
                <>
                    <button
                        onClick={() => navigate(-1)}
                        className="mb-4 text-sm text-[var(--muted)] hover:text-[var(--text)] flex items-center gap-1 transition">
                        ← Volver
                    </button>
                    {/* Carrusel */}
                    <PhotoCarousel
                        photos={listing.photos ?? []}
                        alt={listing.title}
                    />

                    <div className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <h1 className="text-3xl font-semibold">{listing.title}</h1>
                            <span className={`text-sm px-3 py-1 rounded-full font-medium ${LISTING_STATUS_COLORS[listing.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                {LISTING_STATUS_LABELS[listing.status] ?? listing.status}
                            </span>
                        </div>

                        {/* Botón reservar — visible si no eres el owner, no eres admin y el listing está available */}
                        {!isOwner && user?.role !== 'admin' && listing.status === 'available' && (
                            <button
                                onClick={() => setShowReserve(true)}
                                className="w-full rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-95"
                            >
                                Reservar
                            </button>
                        )}

                        {!isOwner && activeTransaction && (
                            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4 text-sm">
                                <p className="font-semibold text-[var(--text)]">Tu reserva</p>
                                <p className="mt-1 text-[var(--muted)]">
                                    Estado:{' '}
                                    <span className={`rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[activeTransaction.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                        {STATUS_LABELS[activeTransaction.status] ?? activeTransaction.status}
                                    </span>
                                </p>
                                {activeTransaction.start_date && activeTransaction.end_date && (
                                    <p className="mt-0.5 text-[var(--muted)]">
                                        {new Date(activeTransaction.start_date).toLocaleDateString('es-ES')} –{' '}
                                        {new Date(activeTransaction.end_date).toLocaleDateString('es-ES')}
                                    </p>
                                )}
                            </div>
                        )}

                        <p className="text-[var(--muted)] leading-relaxed">{listing.description}</p>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-[var(--muted)]">Categoría:</span>
                            <span className="text-xs bg-[var(--surface-strong)] text-[var(--text)] px-3 py-1 rounded-full font-semibold capitalize">
                                {listing.category?.replace(/_/g, ' ') ?? 'Sin categoría'}
                            </span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-[var(--muted)]">Depósito: {listing.deposit_amount} €</p>
                            <p className="text-sm text-[var(--muted)]">Tarifa de gestión: 2 €</p>
                            <p className="text-xl font-semibold text-[var(--accent-2)]">
                                Total: {listing.deposit_amount + 2} €
                            </p>
                        </div>

                        {isOwner && (
                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={() => setEditing(true)}
                                    className="rounded-full bg-[var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--text)]"
                                >
                                    Editar
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="rounded-full bg-red-100 px-4 py-2 text-sm font-semibold text-red-700"
                                >
                                    Borrar
                                </button>
                                <label className="rounded-full bg-[var(--accent-3)]/10 px-4 py-2 text-sm font-semibold text-[var(--accent-3)] cursor-pointer">
                                    {uploading ? 'Subiendo...' : 'Subir foto'}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handlePhotoUpload}
                                        disabled={uploading}
                                    />
                                </label>
                            </div>
                        )}

                        {!isOwner && user?.role === 'admin' && (
                            <div className="flex flex-wrap gap-3 border-t border-red-50 pt-4 mt-2">
                                <div className="w-full text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Acciones de Administrador</div>
                                <button
                                    onClick={handleAdminDelete}
                                    className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition shadow-sm"
                                >
                                    Eliminar anuncio (Moderación)
                                </button>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <form onSubmit={handleUpdate} className="space-y-4 rounded-3xl bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-semibold mb-2">Editar artículo</h2>

                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">Título</span>
                        <input
                            value={form.title}
                            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                            required
                            className="mt-1 block w-full border border-[var(--border)] rounded-2xl p-3 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                        />
                    </label>

                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">Descripción</span>
                        <textarea
                            value={form.description}
                            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                            required
                            rows={4}
                            className="mt-1 block w-full border border-[var(--border)] rounded-2xl p-3 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                        />
                    </label>
                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">Estado</span>
                        <select
                            value={form.status}
                            onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                            className="mt-1 block w-full border border-[var(--border)] rounded-2xl p-3 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                        >
                            <option value="available">Disponible</option>
                            <option value="borrowed">Prestado</option>
                            <option value="inactive">Inactivo</option>
                        </select>
                    </label>
                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">Categoría</span>
                        <select
                            value={form.category}
                            onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                            className="mt-1 block w-full border border-[var(--border)] rounded-2xl p-3 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                        >
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
                    </label>
                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">Depósito (€)</span>
                        <input
                            type="number"
                            step="0.01"
                            value={form.deposit_amount}
                            onChange={e => setForm(p => ({ ...p, deposit_amount: parseFloat(e.target.value) }))}
                            required
                            className="mt-1 block w-full border border-[var(--border)] rounded-2xl p-3 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                        />
                    </label>

                    {error && <p className="text-red-600 text-sm">{error}</p>}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-full bg-[var(--accent-2)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                            {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setEditing(false)}
                            className="rounded-full bg-[var(--surface-strong)] px-5 py-2 text-sm font-semibold text-[var(--text)]"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            )}

            {showReserve && (
                <ReserveModal
                    listingId={listing.id}
                    depositAmount={listing.deposit_amount}
                    onClose={() => setShowReserve(false)}
                    onSuccess={async (transactionId: string) => {
                        setShowReserve(false);
                        setToast('¡Reserva confirmada! El propietario revisará tu solicitud.');
                        try {
                            const tx = await transactionsApi.getById(transactionId);
                            setActiveTransaction(tx);
                        } catch {
                            // best-effort — status banner is optional
                        }
                    }}
                />
            )}

            {toast && <Toast message={toast} onClose={() => setToast(null)} />}
        </div>
    );
}