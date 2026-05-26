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
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
            <div className="glass-panel w-full max-w-4xl overflow-hidden rounded-[32px]">
                <div className="grid md:grid-cols-[1.1fr_0.9fr]">
                    <div className="section-wrap flex flex-col justify-between px-8 py-10 text-left">
                        <div>
                            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--accent-3)]">
                                Vecinos primero
                            </span>
                            <h1 className="font-editorial text-4xl font-semibold mt-6">Bienvenido</h1>
                            <p className="text-sm text-[var(--muted)] mt-3">
                                Accede a tu cuenta
                            </p>
                        </div>
                        <p className="text-sm text-[var(--muted)] mt-8 max-w-xs">
                            Mantente cerca de tus vecinos, gestiona tus prestamos y encuentra nuevos objetos.
                        </p>
                    </div>
                    <div className="bg-white px-8 py-10">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">Iniciar sesion</h2>
                        <p className="text-sm text-[var(--muted)] mt-2">Te estabamos esperando.</p>

                        {error && (
                            <div className="mb-4 mt-6 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
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

                        <p className="mt-6 text-center text-sm text-[var(--muted)]">
                            ¿No tienes cuenta?{' '}
                            <Link to="/register" className="text-[var(--accent-3)] font-semibold hover:underline">
                                Regístrate
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}