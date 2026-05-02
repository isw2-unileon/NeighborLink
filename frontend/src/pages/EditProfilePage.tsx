import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usersApi } from '../lib/users';
import { Input, Button } from '../components/ui';

// ── Helpers de dirección ─────────────────────────────────────────────────────

const NO_NUMBERS_REGEX = /^[^\d]+$/;
const ADDRESS_ERROR_MSG = 'Este campo solo admite letras. No incluyas números.';

function parseAddress(address: string) {
    const parts = address.split(',').map(s => s.trim());
    return { street: parts[0] ?? '', city: parts[1] ?? '', province: parts[2] ?? '' };
}

function buildAddress(street: string, city: string, province: string) {
    return `${street}, ${city}, ${province}, España`;
}

// ── Tipos ────────────────────────────────────────────────────────────────────

interface FormState {
    name: string; street: string; city: string; province: string;
}
interface FieldErrors {
    street: string; city: string; province: string;
}
const EMPTY_ERRORS: FieldErrors = { street: '', city: '', province: '' };

// ── EditProfilePage ───────────────────────────────────────────────────────────

export default function EditProfilePage() {
    const { user, token, updateUser } = useAuth();
    const navigate = useNavigate();

    const [form, setForm] = useState<FormState>({ name: '', street: '', city: '', province: '' });
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>(EMPTY_ERRORS);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            const { street, city, province } = parseAddress(user.address ?? '');
            setForm({ name: user.name, street, city, province });
        }
    }, [user]);

    if (!user || !token) return null;

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        if (name in fieldErrors) setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }

    function validateAddress(): boolean {
        const errors: FieldErrors = { street: '', city: '', province: '' };
        if (form.street && !NO_NUMBERS_REGEX.test(form.street)) errors.street = ADDRESS_ERROR_MSG;
        if (form.city && !NO_NUMBERS_REGEX.test(form.city)) errors.city = ADDRESS_ERROR_MSG;
        if (form.province && !NO_NUMBERS_REGEX.test(form.province)) errors.province = ADDRESS_ERROR_MSG;
        setFieldErrors(errors);
        return !errors.street && !errors.city && !errors.province;
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        if (!validateAddress()) return;
        setError(null);
        setSaving(true);
        try {
            const updated = await usersApi.updateMe({
                name: form.name,
                address: buildAddress(form.street, form.city, form.province),
            });
            updateUser({ ...user, ...updated });
            navigate('/profile');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al guardar');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="max-w-lg mx-auto p-6">
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate('/profile')} className="text-sm text-gray-500 hover:text-gray-700">
                    ← Cancelar
                </button>
                <h1 className="text-xl font-bold text-gray-900">Editar perfil</h1>
            </div>

            {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                    {error}
                </p>
            )}

            <form onSubmit={handleSave} className="flex flex-col gap-4">
                <Input label="Nombre" name="name" value={form.name}
                    onChange={handleChange} required maxLength={80} />
                <Input label="Email" name="email" value={user.email} disabled />

                <div className="flex flex-col gap-3">
                    <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                        📍 No necesitamos tu dirección exacta. Con la calle y localidad es suficiente.
                    </p>
                    <Input label="Calle" name="street" value={form.street}
                        onChange={handleChange} placeholder="Ej: Calle Mayor" error={fieldErrors.street} />
                    <Input label="Localidad" name="city" value={form.city}
                        onChange={handleChange} placeholder="Ej: León" error={fieldErrors.city} />
                    <Input label="Provincia" name="province" value={form.province}
                        onChange={handleChange} placeholder="Ej: León" error={fieldErrors.province} />
                </div>

                <div className="flex gap-3 mt-2">
                    <Button type="button" onClick={() => navigate('/profile')}>Cancelar</Button>
                    <Button type="submit" loading={saving}>Guardar cambios</Button>
                </div>
            </form>
        </div>
    );
}