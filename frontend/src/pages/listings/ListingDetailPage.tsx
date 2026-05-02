import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listingsApi } from '../../lib/listings';
import { useAuth } from '../../contexts/AuthContext';
import type { Listing } from '../../types';

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
                className="w-full max-h-96 object-contain rounded-xl bg-gray-50"
            />

            {/* Flechas — solo si hay más de una foto */}
            {photos.length > 1 && (
                <>
                    <button
                        onClick={prev}
                        aria-label="Foto anterior"
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white shadow rounded-full w-9 h-9 flex items-center justify-center text-gray-700 transition"
                    >
                        ←
                    </button>
                    <button
                        onClick={next}
                        aria-label="Foto siguiente"
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white shadow rounded-full w-9 h-9 flex items-center justify-center text-gray-700 transition"
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
                                className={`w-2 h-2 rounded-full transition-colors ${i === current ? 'bg-blue-600' : 'bg-gray-300'
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
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al borrar');
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
        <div className="max-w-2xl mx-auto p-6">
            {!editing ? (
                <>
                    <button
                        onClick={() => navigate(-1)}
                        className="mb-4 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 transition">
                        ← Volver
                    </button>
                    {/* Carrusel */}
                    <PhotoCarousel
                        photos={listing.photos ?? []}
                        alt={listing.title}
                    />

                    <div className="flex justify-between items-start">
                        <h1 className="text-3xl font-bold">{listing.title}</h1>
                        <span className={`text-sm px-3 py-1 rounded-full font-medium ${listing.status === 'available'
                            ? 'bg-green-100 text-green-700'
                            : listing.status === 'borrowed'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                            {listing.status}
                        </span>
                    </div>

                    <p className="mt-3 text-gray-600 leading-relaxed">{listing.description}</p>
                    <div className="mt-3 flex items-center gap-2">
                        <span className="text-sm text-gray-500">Categoría:</span>
                        <span className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-medium capitalize">
                            {listing.category?.replace(/_/g, ' ') ?? 'Sin categoría'}
                        </span>
                    </div>
                    <p className="mt-4 text-xl font-semibold text-blue-600">
                        {listing.deposit_amount} € depósito
                    </p>

                    {isOwner && (
                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={() => setEditing(true)}
                                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
                            >
                                Editar
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium"
                            >
                                Borrar
                            </button>
                            <label className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium cursor-pointer">
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
                </>
            ) : (
                <form onSubmit={handleUpdate} className="space-y-4">
                    <h2 className="text-xl font-bold mb-4">Editar artículo</h2>

                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">Título</span>
                        <input
                            value={form.title}
                            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                            required
                            className="mt-1 block w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </label>

                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">Descripción</span>
                        <textarea
                            value={form.description}
                            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                            required
                            rows={4}
                            className="mt-1 block w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </label>
                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">Estado</span>
                        <select
                            value={form.status}
                            onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                            className="mt-1 block w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            className="mt-1 block w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            className="mt-1 block w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </label>

                    {error && <p className="text-red-600 text-sm">{error}</p>}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                        >
                            {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setEditing(false)}
                            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}