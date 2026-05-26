import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listingsApi } from '../lib/listings';
import { useAuth } from '../contexts/AuthContext';
import type { Listing } from '../types';

interface CreateListingInput {
    title: string;
    description: string;
    photos: string[];
    deposit_amount: number;
    category: string;
    status: string;
}

const EMPTY_FORM: CreateListingInput = {
    title: '',
    description: '',
    photos: [],
    deposit_amount: 0,
    category: 'otros',
    status: 'available',
}

type Step = 'info' | 'photos';

export default function CreateListingPage() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [step, setStep] = useState<Step>('info');
    const [form, setForm] = useState<CreateListingInput>(EMPTY_FORM)
    const [createdListing, setCreatedListing] = useState<Listing | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    if (!user) {
        navigate('/login');
        return null;
    }

    // PASO 1 — Crear el listing
    async function handleSubmitInfo(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSaving(true);
        try {
            const listing = await listingsApi.create(form);
            setCreatedListing(listing);
            setStep('photos');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al crear el artículo');
        } finally {
            setSaving(false);
        }
    }

    // PASO 2 — Subir foto
    async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !createdListing) return;
        setUploading(true);
        setError(null);
        try {
            const updated = await listingsApi.uploadPhoto(createdListing.id, file);
            setCreatedListing(updated);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al subir la foto');
        } finally {
            setUploading(false);
            // Reset input para poder subir otra foto
            e.target.value = '';
        }
    }

    function handleFinish() {
        navigate(`/listings/${createdListing!.id}`);
    }

    // --- RENDER PASO 1 ---
    if (step === 'info') {
        return (
            <div className="max-w-2xl mx-auto px-4 py-8">
                <button
                    onClick={() => navigate(-1)}
                    className="text-sm text-[var(--muted)] hover:text-[var(--text)] mb-6 flex items-center gap-1"
                >
                    ← Volver
                </button>

                {/* Indicador de progreso */}
                <div className="flex items-center gap-2 mb-6">
                    <span className="w-8 h-8 rounded-full bg-[var(--accent-2)] text-white text-sm flex items-center justify-center font-semibold">1</span>
                    <span className="text-sm font-medium text-[var(--text)]">Información básica</span>
                    <span className="flex-1 h-px bg-[var(--border)] mx-2" />
                    <span className="w-8 h-8 rounded-full bg-[var(--surface-strong)] text-[var(--muted)] text-sm flex items-center justify-center font-semibold">2</span>
                    <span className="text-sm text-[var(--muted)]">Fotos</span>
                </div>

                <h1 className="font-editorial text-3xl font-semibold mb-6">Publicar artículo</h1>

                {error && (
                    <p className="text-red-600 bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 text-sm">
                        {error}
                    </p>
                )}

                <form onSubmit={handleSubmitInfo} className="space-y-5 rounded-3xl bg-white p-6 shadow-sm">
                    <label className="block">
                        <span className="text-sm font-medium text-[var(--muted)]">Título *</span>
                        <input
                            value={form.title}
                            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                            placeholder="ej: Taladro Bosch"
                            required
                            maxLength={120}
                            className="mt-1 block w-full border border-[var(--border)] rounded-2xl p-3 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                        />
                    </label>

                    <label className="block">
                        <span className="text-sm font-medium text-[var(--muted)]">Descripción *</span>
                        <textarea
                            value={form.description}
                            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                            placeholder="Estado, accesorios incluidos, condiciones de préstamo..."
                            required
                            rows={4}
                            className="mt-1 block w-full border border-[var(--border)] rounded-2xl p-3 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                        />
                    </label>
                    <label className="block">
                        <span className="text-sm font-medium text-[var(--muted)]">Categoría *</span>
                        <select
                            value={form.category}
                            onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                            required
                            className="mt-1 block w-full border border-[var(--border)] rounded-2xl p-3 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]">
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
                        <span className="text-sm font-medium text-[var(--muted)]">Depósito (€) *</span>
                        <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={form.deposit_amount === 0 ? '' : form.deposit_amount}
                            onChange={e => setForm(p => ({ ...p, deposit_amount: parseFloat(e.target.value) || 0 }))}
                            placeholder="ej: 50"
                            required
                            className="mt-1 block w-full border border-[var(--border)] rounded-2xl p-3 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                        />
                    </label>

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full rounded-full bg-[var(--accent-2)] py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
                    >
                        {saving ? 'Creando...' : 'Siguiente → Fotos'}
                    </button>
                </form>
            </div>
        );
    }

    // --- RENDER PASO 2 ---
    return (
        <div className="max-w-2xl mx-auto px-4 py-8">
            {/* Indicador de progreso */}
            <div className="flex items-center gap-2 mb-6">
                <span className="w-8 h-8 rounded-full bg-[var(--accent-2)] text-white text-sm flex items-center justify-center font-semibold">✓</span>
                <span className="text-sm text-[var(--muted)]">Información básica</span>
                <span className="flex-1 h-px bg-[var(--border)] mx-2" />
                <span className="w-8 h-8 rounded-full bg-[var(--accent-2)] text-white text-sm flex items-center justify-center font-semibold">2</span>
                <span className="text-sm font-medium text-[var(--text)]">Fotos</span>
            </div>

            <h1 className="font-editorial text-3xl font-semibold mb-2">Añadir fotos</h1>
            <p className="text-[var(--muted)] text-sm mb-6">
                Puedes subir varias fotos. Este paso es opcional — puedes saltarlo y añadirlas después.
            </p>

            {error && (
                <p className="text-red-600 bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 text-sm">
                    {error}
                </p>
            )}

            {/* Fotos subidas */}
            {createdListing && createdListing.photos.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                    {createdListing.photos.map((url, i) => (
                        <img
                            key={i}
                            src={url}
                            alt={`Foto ${i + 1}`}
                            className="w-full h-24 object-cover rounded-2xl border border-[var(--border)]"
                        />
                    ))}
                </div>
            )}

            {/* Botón subir */}
            <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-[var(--border)] rounded-3xl cursor-pointer hover:border-[var(--accent-2)] hover:bg-[var(--surface-strong)] transition-colors mb-6">
                <div className="text-center">
                    {uploading ? (
                        <p className="text-sm text-[var(--muted)]">Subiendo...</p>
                    ) : (
                        <>
                            <p className="text-2xl mb-1">📷</p>
                            <p className="text-sm text-[var(--muted)]">Haz clic para subir una foto</p>
                        </>
                    )}
                </div>
                <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                    disabled={uploading}
                />
            </label>

            <div className="flex gap-3">
                <button
                    onClick={handleFinish}
                    disabled={!createdListing || createdListing.photos.length === 0}
                    className="w-full rounded-full bg-[var(--accent-2)] py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Publicar artículo
                </button>
                {createdListing && createdListing.photos.length === 0 && (
                    <p className="text-center text-sm text-[var(--muted)] mt-2">
                        Sube al menos una foto para continuar
                    </p>
                )}
            </div>
        </div>
    );
}