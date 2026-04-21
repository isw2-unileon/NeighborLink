import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Input, Button } from '../components/ui';
import type { AuthResponse } from '../types';

export default function LoginPage() {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const resp = await api.post<AuthResponse>('/auth/login', form);
            login(resp.token, resp.user);
            navigate('/listings');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Bienvenido</h1>
                <p className="text-sm text-gray-500 mb-6">Accede a tu cuenta</p>

                {error && (
                    <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <Input
                        label="Email"
                        name="email"
                        type="email"
                        placeholder="tu@email.com"
                        value={form.email}
                        onChange={handleChange}
                        required
                    />
                    <Input
                        label="Contraseña"
                        name="password"
                        type="password"
                        placeholder="Tu contraseña"
                        value={form.password}
                        onChange={handleChange}
                        required
                    />
                    <Button type="submit" loading={loading}>
                        Iniciar sesión
                    </Button>
                </form>

                <p className="mt-6 text-center text-sm text-gray-500">
                    ¿No tienes cuenta?{' '}
                    <Link to="/register" className="text-teal-700 font-medium hover:underline">
                        Regístrate
                    </Link>
                </p>
            </div>
        </div>
    );
}