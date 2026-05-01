import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Input, Button } from '../components/ui';
import type { AuthResponse } from '../types';

const NO_NUMBERS_REGEX = /^[^\d]+$/;
const ADDRESS_ERROR_MSG = 'Este campo solo admite letras. No incluyas números — no necesitamos saber el portal ni el piso.';

type AddressFieldErrors = { street: string; city: string; province: string };

export default function RegisterPage() {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [form, setForm] = useState({ name: '', email: '', password: '', street: '', city: '', province: '' });
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<AddressFieldErrors>({ street: '', city: '', province: '' });
    const [loading, setLoading] = useState(false);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        if (name in fieldErrors) {
            setFieldErrors(prev => ({ ...prev, [name]: '' }));
        }
    }

    function validateAddressFields(): boolean {
        const errors: AddressFieldErrors = { street: '', city: '', province: '' };
        if (!NO_NUMBERS_REGEX.test(form.street)) errors.street = ADDRESS_ERROR_MSG;
        if (!NO_NUMBERS_REGEX.test(form.city)) errors.city = ADDRESS_ERROR_MSG;
        if (!NO_NUMBERS_REGEX.test(form.province)) errors.province = ADDRESS_ERROR_MSG;
        setFieldErrors(errors);
        return !errors.street && !errors.city && !errors.province;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!validateAddressFields()) return;

        setError(null);
        setLoading(true);
        try {
            const address = `${form.street}, ${form.city}, ${form.province}, España`;
            const resp = await api.post<AuthResponse>('/auth/register', {
                name: form.name,
                email: form.email,
                password: form.password,
                address,
            });
            login(resp.token, resp.user);
            navigate('/listings');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al registrarse');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Crear cuenta</h1>
                <p className="text-sm text-gray-500 mb-6">Únete a NeighborLink</p>

                {error && (
                    <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <Input
                        label="Nombre"
                        name="name"
                        type="text"
                        placeholder="Tu nombre"
                        value={form.name}
                        onChange={handleChange}
                        required
                    />
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
                        placeholder="Mínimo 6 caracteres"
                        value={form.password}
                        onChange={handleChange}
                        required
                    />

                    <div className="flex flex-col gap-3">
                        <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                            📍 NeighborLink no necesita tu dirección exacta. Con la calle y tu localidad es suficiente para encontrar vecinos cerca de ti.
                        </p>
                        <div>
                            <Input
                                label="Calle"
                                name="street"
                                type="text"
                                placeholder="Ej: Calle Mayor"
                                value={form.street}
                                onChange={handleChange}
                                required
                            />
                            {fieldErrors.street && (
                                <p className="mt-1 text-xs text-red-600">{fieldErrors.street}</p>
                            )}
                        </div>
                        <div>
                            <Input
                                label="Localidad"
                                name="city"
                                type="text"
                                placeholder="Ej: León"
                                value={form.city}
                                onChange={handleChange}
                                required
                            />
                            {fieldErrors.city && (
                                <p className="mt-1 text-xs text-red-600">{fieldErrors.city}</p>
                            )}
                        </div>
                        <div>
                            <Input
                                label="Provincia"
                                name="province"
                                type="text"
                                placeholder="Ej: León"
                                value={form.province}
                                onChange={handleChange}
                                required
                            />
                            {fieldErrors.province && (
                                <p className="mt-1 text-xs text-red-600">{fieldErrors.province}</p>
                            )}
                        </div>
                    </div>

                    <Button type="submit" loading={loading}>
                        Registrarse
                    </Button>
                </form>

                <p className="mt-6 text-center text-sm text-gray-500">
                    ¿Ya tienes cuenta?{' '}
                    <Link to="/login" className="text-teal-700 font-medium hover:underline">
                        Inicia sesión
                    </Link>
                </p>
            </div>
        </div>
    );
}