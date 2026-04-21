import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listingsApi } from '../lib/listings';
import { useAuth } from '../contexts/AuthContext';

interface ListingInput {
    title: string;
    description: string;
    photos: string[];
    deposit_amount: number;
}

const EMPTY_FORM: ListingInput = {
    title: '',
    description: '',
    photos: [],
    deposit_amount: 0,
};

function sanitizeUrl(url: string): string {
    try {
        const parsed = new URL(url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.href;
        }
    } catch {
        // URL inválida
    }
    return '';
}

export default function CreateListingPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState<ListingInput>(EMPTY_FORM);
    const [photoInput, setPhotoInput] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Redirige si no está logueado
    if (!user) {
        navigate('/login');
        return null;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSaving(true);
        try {
            const listing = await listingsApi.create(form);
            navigate(`/listings/${listing.id}`);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al crear el artículo');
        } finally {
            setSaving(false);
        }
    }

    function addPhoto() {
        const url = photoInput.trim();
        if (!url) return;
        
        // Validar que sea una URL http/https válida
         const safe = sanitizeUrl(url);
        if (!safe) {
            setError('La URL no es válida o no empieza por http:// o https://');
            return;
        }

        setError(null);
        setForm(p => ({ ...p, photos: [...p.photos, url] }));
        setPhotoInput('');
    }

    function removePhoto(index: number) {
        setForm(p => ({ ...p, photos: p.photos.filter((_, i) => i !== index) }));
    }

    return (
        <div className="max-w-lg mx-auto p-6">
            <button
                onClick={() => navigate(-1)}
                className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1"
            >
                ← Volver
            </button>

            <h1 className="text-2xl font-bold mb-6">Publicar artículo</h1>

            {error && (
                <p className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm">
                    {error}
                </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                <label className="block">
                    <span className="text-sm font-medium text-gray-700">Título *</span>
                    <input
                        value={form.title}
                        onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                        placeholder="ej: Taladro Bosch"
                        required
                        maxLength={120}
                        className="mt-1 block w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </label>

                <label className="block">
                    <span className="text-sm font-medium text-gray-700">Descripción *</span>
                    <textarea
                        value={form.description}
                        onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                        placeholder="Estado, accesorios incluidos, condiciones de préstamo..."
                        required
                        rows={4}
                        className="mt-1 block w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </label>

                <label className="block">
                    <span className="text-sm font-medium text-gray-700">Depósito (€) *</span>
                    <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={form.deposit_amount === 0 ? '' : form.deposit_amount}
                        onChange={e => setForm(p => ({ ...p, deposit_amount: parseFloat(e.target.value) || 0 }))}
                        placeholder="ej: 50"
                        required
                        className="mt-1 block w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </label>

                {/* Fotos por URL */}
                <div>
                    <span className="text-sm font-medium text-gray-700">Fotos (URLs)</span>
                    <div className="flex gap-2 mt-1">
                        <input
                            value={photoInput}
                            onChange={e => setPhotoInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPhoto())}
                            placeholder="https://..."
                            className="flex-1 border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            type="button"
                            onClick={addPhoto}
                            className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
                        >
                            Añadir
                        </button>
                    </div>

                    {form.photos.length > 0 && (
                        <ul className="mt-2 space-y-2">
                            {form.photos.map((url, i) => {
                                const safeUrl = sanitizeUrl(url);
                                if (!safeUrl) return null;
                                return (
                                    <li key={i} className="flex items-center gap-2 text-sm">
                                        <img
                                            src={safeUrl}
                                            alt=""
                                            referrerPolicy="no-referrer"
                                            className="w-12 h-12 object-cover rounded-lg border"
                                            onError={e => (e.currentTarget.style.display = 'none')}
                                        />
                                        <span className="flex-1 truncate text-gray-600">{url}</span>
                                        <button
                                            type="button"
                                            onClick={() => removePhoto(i)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            ✕
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                    {saving ? 'Publicando...' : 'Publicar artículo'}
                </button>
            </form>
        </div>
    );
}