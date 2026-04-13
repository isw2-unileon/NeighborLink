import { useAuth } from '../contexts/AuthContext';

export default function ProfilePage() {
    const { user } = useAuth();
    return <h1 className="text-2xl font-bold">Perfil de {user?.name}</h1>;
}