import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';

// Hook sencillo para animar elementos al entrar en el viewport
function useScrollReveal() {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (!entry) return;
                if (entry.isIntersecting) {
                    entry.target.classList.add('opacity-100', 'translate-y-0');
                    entry.target.classList.remove('opacity-0', 'translate-y-8');
                }
            },
            { threshold: 0.15 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);
    return ref;
}

function RevealSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    const ref = useScrollReveal();
    return (
        <div
            ref={ref}
            className={`opacity-0 translate-y-8 transition-all duration-700 ease-out ${className}`}
        >
            {children}
        </div>
    );
}

export default function HomePage() {
    return (
        <div className="flex flex-col">

            {/* HERO */}
            <section className="flex flex-col items-center text-center py-24 px-4 gap-6">
                <span className="text-xs font-semibold tracking-widest text-teal-700 uppercase bg-teal-50 px-3 py-1 rounded-full">
                    Economía vecinal
                </span>
                <h1 className="text-5xl font-bold text-gray-900 max-w-2xl leading-tight">
                    Lo que necesitas ya existe.{'  '}
                    <span className="text-teal-700">A dos calles de ti.</span>
                </h1>
                <p className="text-lg text-gray-500 max-w-xl">
                    Deja de comprar cosas que usarás dos veces. Pídelas prestadas a tus vecinos,
                    o gana dinero con todo lo que tienes cogiendo polvo en el trastero.
                </p>
                <div className="flex gap-4 mt-4">
                    <Link
                        to="/register"
                        className="bg-teal-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-teal-800 transition-colors shadow-sm"
                    >
                        Empieza gratis
                    </Link>
                    <Link
                        to="/login"
                        className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                    >
                        Iniciar sesión
                    </Link>
                </div>
            </section>



            {/* POR QUÉ NOSOTROS */}
            <RevealSection>
                <section className="py-20 px-4">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-gray-900">¿Por qué NeighborLink?</h2>
                        <p className="text-gray-500 mt-3 max-w-lg mx-auto">
                            Vivimos en una época de consumismo desenfrenado. Compramos cosas para usarlas
                            una vez y olvidarlas. Hay una forma mejor.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                emoji: '🌱',
                                title: 'Frena el consumismo',
                                desc: 'Cada objeto prestado es un objeto que no se fabrica. Pequeños gestos, impacto real en el planeta.',
                            },
                            {
                                emoji: '💸',
                                title: 'Ahorra dinero',
                                desc: '¿Para qué comprar una escalera de mano si solo la necesitas un día? Alquílala por una fracción del precio.',
                            },
                            {
                                emoji: '🤝',
                                title: 'Construye comunidad',
                                desc: 'Conoce a las personas que viven cerca de ti. La confianza vecinal empieza por un pequeño favor.',
                            },
                        ].map(({ emoji, title, desc }) => (
                            <div
                                key={title}
                                className="flex flex-col gap-3 p-6 bg-white rounded-xl border border-gray-100 shadow-sm"
                            >
                                <span className="text-3xl">{emoji}</span>
                                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </RevealSection>

            {/* CÓMO FUNCIONA */}
            <RevealSection>
                <section className="py-20 px-4 bg-gray-50 rounded-2xl">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-gray-900">Tan fácil como esto</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
                        {[
                            { step: '01', title: 'Regístrate', desc: 'Crea tu cuenta en menos de un minuto con tu dirección y ya estás dentro.' },
                            { step: '02', title: 'Explora o publica', desc: 'Busca lo que necesitas cerca de ti o publica lo que tienes en casa sin usar.' },
                            { step: '03', title: 'Conéctate', desc: 'Habla con tu vecino, acordad los detalles y listo. Sin intermediarios.' },
                        ].map(({ step, title, desc }) => (
                            <div key={step} className="flex flex-col gap-3 text-center">
                                <span className="text-5xl font-bold text-teal-100 select-none">{step}</span>
                                <h3 className="text-lg font-semibold text-gray-900 -mt-4">{title}</h3>
                                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </RevealSection>

            {/* CTA FINAL */}
            <RevealSection>
                <section className="flex flex-col items-center text-center py-24 px-4 gap-6">
                    <h2 className="text-3xl font-bold text-gray-900 max-w-lg">
                        Tu trastero tiene más valor del que crees.
                    </h2>
                    <p className="text-gray-500 max-w-md">
                        Únete a NeighborLink y empieza a compartir hoy. Es gratis, es local y
                        es exactamente lo que tu barrio necesita.
                    </p>
                    <Link
                        to="/register"
                        className="bg-teal-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-teal-800 transition-colors shadow-sm"
                    >
                        Unirme ahora
                    </Link>
                </section>
            </RevealSection>

        </div>
    );
}