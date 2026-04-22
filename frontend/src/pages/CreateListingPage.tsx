import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listingsApi } from '../lib/listings';
import { useAuth } from '../contexts/AuthContext';
import type { Listing } from '../types';

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

type Step = 'info' | 'photos';

export default function CreateListingPage() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [step, setStep] = useState<Step>('info');
    const [form, setForm] = useState<ListingInput>(EMPTY_FORM);
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
            <div className="max-w-lg mx-auto p-6">
                <button
                    onClick={() => navigate(-1)}
                    className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1"
                >
                    ← Volver
                </button>

                {/* Indicador de progreso */}
                <div className="flex items-center gap-2 mb-6">
                    <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center font-medium">1</span>
                    <span className="text-sm font-medium text-gray-700">Información básica</span>
                    <span className="flex-1 h-px bg-gray-200 mx-2" />
                    <span className="w-7 h-7 rounded-full bg-gray-200 text-gray-400 text-sm flex items-center justify-center font-medium">2</span>
                    <span className="text-sm text-gray-400">Fotos</span>
                </div>

                <h1 className="text-2xl font-bold mb-6">Publicar artículo</h1>

                {error && (
                    <p className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm">
                        {error}
                    </p>
                )}

                <form onSubmit={handleSubmitInfo} className="space-y-5">
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

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                    >
                        {saving ? 'Creando...' : 'Siguiente → Fotos'}
                    </button>
                </form>
            </div>
        );
    }

    // --- RENDER PASO 2 ---
    return (
        <div className="max-w-lg mx-auto p-6">
            {/* Indicador de progreso */}
            <div className="flex items-center gap-2 mb-6">
                <span className="w-7 h-7 rounded-full bg-green-500 text-white text-sm flex items-center justify-center font-medium">✓</span>
                <span className="text-sm text-gray-400">Información básica</span>
                <span className="flex-1 h-px bg-gray-200 mx-2" />
                <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center font-medium">2</span>
                <span className="text-sm font-medium text-gray-700">Fotos</span>
            </div>

            <h1 className="text-2xl font-bold mb-2">Añadir fotos</h1>
            <p className="text-gray-500 text-sm mb-6">
                Puedes subir varias fotos. Este paso es opcional — puedes saltarlo y añadirlas después.
            </p>

            {error && (
                <p className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm">
                    {error}
                </p>
            )}

            {/* Fotos subidas */}
            {createdListing && createdListing.photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-4">
                    {createdListing.photos.map((url, i) => (
                        <img
                            key={i}
                            src={url}
                            alt={`Foto ${i + 1}`}
                            className="w-full h-24 object-cover rounded-lg border"
                        />
                    ))}
                </div>
            )}

            {/* Botón subir */}
            <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors mb-6">
                <div className="text-center">
                    {uploading ? (
                        <p className="text-sm text-gray-500">Subiendo...</p>
                    ) : (
                        <>
                            <p className="text-2xl mb-1">📷</p>
                            <p className="text-sm text-gray-500">Haz clic para subir una foto</p>
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
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                    Publicar artículo
                </button>
                {createdListing && createdListing.photos.length === 0 && (
                    <p className="text-center text-sm text-gray-400 mt-2">
                        Sube al menos una foto para continuar
                    </p>
                )}
            </div>
        </div>
    );
}