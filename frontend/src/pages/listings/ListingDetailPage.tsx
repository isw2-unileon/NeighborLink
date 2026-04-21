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
}

export default function ListingDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [listing, setListing] = useState<Listing | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<ListingInput>({
        title: '',
        description: '',
        photos: [],
        deposit_amount: 0,
    });
console.log({ loading, error, listing });
    const isOwner = user?.id === listing?.owner_id;

    useEffect(() => {
        if (!id) return;
        listingsApi.getById(id)
            .then(data => {
                setListing(data);
                setForm({
                    title: data.title,
                    description: data.description,
                    photos: data.photos ? [data.photos] : [],
                    deposit_amount: data.deposit_amount,
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
                    {listing.photos && (
                        <img
                            src={listing.photos}
                            alt={listing.title}
                            className="w-full h-64 object-cover rounded-xl mb-6"
                        />
                    )}

                    <div className="flex justify-between items-start">
                        <h1 className="text-3xl font-bold">{listing.title}</h1>
                        <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                            listing.status === 'available'
                                ? 'bg-green-100 text-green-700'
                                : listing.status === 'borrowed'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-600'
                        }`}>
                            {listing.status}
                        </span>
                    </div>

                    <p className="mt-3 text-gray-600 leading-relaxed">{listing.description}</p>

                    <p className="mt-4 text-xl font-semibold text-blue-600">
                        {listing.deposit_amount} € depósito
                    </p>

                    {/* Botones visibles solo al owner */}
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