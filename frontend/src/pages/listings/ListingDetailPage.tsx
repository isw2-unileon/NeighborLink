import { useParams } from 'react-router-dom';

export default function ListingDetailPage() {
    const { id } = useParams<{ id: string }>();
    return <h1 className="text-2xl font-bold">Artículo: {id}</h1>;
}