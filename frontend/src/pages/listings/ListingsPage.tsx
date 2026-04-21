import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listingsApi } from '../../lib/listings';
import { useAuth } from '../../contexts/AuthContext';
import type { Listing } from '../../types';

export default function ListingsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [listings, setListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        listingsApi.getAll()
            .then(setListings)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-64">
                <p className="text-gray-500">Cargando artículos...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <p className="text-red-600">Error: {error}</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Explorar artículos</h1>
                {user && (
                    <button
                        onClick={() => navigate('/listings/new')}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                        + Publicar artículo
                    </button>
                )}
            </div>

            {listings.length === 0 ? (
                <p className="text-gray-500 text-center py-12">
                    No hay artículos disponibles todavía.
                </p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {listings.map(listing => (
                        <Link
                            key={listing.id}
                            to={`/listings/${listing.id}`}
                            className="border rounded-xl p-4 hover:shadow-md transition-shadow bg-white"
                        >
                            {listing.photos && listing.photos.length > 0 && (
                                <img
                                    src={listing.photos[0]}
                                    alt={listing.title}
                                    className="w-full h-40 object-cover rounded-lg mb-3"
                                />
                            )}
                            <h2 className="font-semibold text-lg">{listing.title}</h2>
                            <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                                {listing.description}
                            </p>
                            <p className="text-blue-600 font-medium mt-2">
                                {listing.deposit_amount} € depósito
                            </p>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}