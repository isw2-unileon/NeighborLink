import { useEffect, useState } from 'react'

interface Usuario {
  id: string
  nombre: string
  apellidos: string
  edad: number
  correo: string
}

export default function App() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/usuarios')
      .then(res => res.json())
      .then(body => setUsuarios(body.data ?? []))
      .catch(() => setError('Could not load users'))
  }, [])
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">NeighBorLink</h1>
        <p className="text-gray-500 mb-8">Welcome — these are our users</p>

        {error && <p className="text-red-500 mb-4">{error}</p>}

        <ul className="space-y-3 text-left">
          {usuarios.map(u => (
            <li key={u.id} className="bg-white shadow rounded-lg px-5 py-4">
              <p className="font-semibold text-gray-800">{u.nombre} {u.apellidos}</p>
              <p className="text-sm text-gray-500">{u.correo} · {u.edad} años</p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
