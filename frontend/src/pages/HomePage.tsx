import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import drillThumb from '../assets/taladro-percutor-1200w-aicer.jpg';

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
        <div className="flex flex-col gap-20 pb-10">
            {/* HERO */}
            <section className="section-wrap overflow-hidden rounded-[32px] px-6 py-20 md:px-12">
                <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="flex flex-col gap-6">
                        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--accent-3)]">
                            Economía vecinal
                        </span>
                        <h1 className="font-editorial text-5xl font-semibold leading-[1.05] md:text-6xl md:leading-[1.05] max-w-2xl">
                            <span className="block">Lo que necesitas ya existe.</span>
                            <span className="block text-[var(--accent)] mt-2">A dos calles de ti.</span>
                        </h1>
                        <p className="text-lg text-[var(--muted)] md:text-xl">
                            Deja de comprar cosas que usarás dos veces. Pídelas prestadas a tus vecinos,
                            o gana dinero con todo lo que tienes cogiendo polvo en el trastero.
                        </p>
                        <div className="flex flex-wrap gap-4">
                            <Link
                                to="/register"
                                className="rounded-full bg-[var(--accent)] px-8 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-95"
                            >
                                Empieza gratis
                            </Link>
                            <Link
                                to="/login"
                                className="rounded-full border border-[var(--border)] bg-white px-8 py-3 text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-strong)]"
                            >
                                Iniciar sesión
                            </Link>
                        </div>
                    </div>
                    <div className="glass-panel soft-shadow rounded-[28px] p-6">
                        <div className="grid gap-4">
                            <div className="rounded-2xl bg-[var(--surface-strong)] p-5">
                                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Cerca de ti</p>
                                <p className="mt-2 font-editorial text-2xl">Comparte en tu barrio</p>
                                <p className="mt-2 text-sm text-[var(--muted)]">
                                    Encuentra objetos con confianza, con gente que vive a minutos.
                                </p>
                            </div>
                            <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
                                <div className="flex items-center justify-between text-sm text-[var(--muted)]">
                                    <span>Hoy en tu zona</span>
                                    <span className="font-semibold text-[var(--accent-2)]">12 nuevos objetos</span>
                                </div>
                                <div className="mt-4 flex items-center gap-3">
                                    <img
                                        src={drillThumb}
                                        alt="Taladro Bosch"
                                        className="h-12 w-12 rounded-xl border border-[var(--border)] object-cover"
                                    />
                                    <div>
                                        <p className="text-sm font-semibold">Taladro Bosch</p>
                                        <p className="text-xs text-[var(--muted)]">Disponible hoy</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* POR QUÉ NOSOTROS */}
            <RevealSection>
                <section className="px-4">
                    <div className="text-center mb-12">
                        <h2 className="font-editorial text-4xl font-semibold">¿Por qué NeighborLink?</h2>
                        <p className="text-[var(--muted)] mt-4 max-w-lg mx-auto">
                            Vivimos en una época de consumismo desenfrenado. Compramos cosas para usarlas
                            una vez y olvidarlas. Hay una forma mejor.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
                                className="glass-panel rounded-3xl p-6 transition hover:-translate-y-1"
                            >
                                <span className="text-3xl">{emoji}</span>
                                <h3 className="mt-3 text-lg font-semibold text-[var(--text)]">{title}</h3>
                                <p className="text-sm text-[var(--muted)] leading-relaxed mt-2">{desc}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </RevealSection>

            {/* CÓMO FUNCIONA */}
            <RevealSection>
                <section className="section-wrap rounded-[32px] px-6 py-16">
                    <div className="text-center mb-12">
                        <h2 className="font-editorial text-4xl font-semibold">Tan fácil como esto</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                        {[
                            { step: '01', title: 'Regístrate', desc: 'Crea tu cuenta en menos de un minuto con tu dirección y ya estás dentro.' },
                            { step: '02', title: 'Explora o publica', desc: 'Busca lo que necesitas cerca de ti o publica lo que tienes en casa sin usar.' },
                            { step: '03', title: 'Conéctate', desc: 'Habla con tu vecino, acordad los detalles y listo. Sin intermediarios.' },
                        ].map(({ step, title, desc }) => (
                            <div key={step} className="rounded-3xl bg-white px-6 py-8 text-center shadow-sm">
                                <span className="text-5xl font-semibold text-[var(--accent-2)]">{step}</span>
                                <h3 className="mt-3 text-lg font-semibold text-[var(--text)]">{title}</h3>
                                <p className="text-sm text-[var(--muted)] leading-relaxed mt-2">{desc}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </RevealSection>

            {/* CTA FINAL */}
            <RevealSection>
                <section className="flex flex-col items-center text-center gap-6 rounded-[32px] bg-white px-6 py-16 shadow-sm">
                    <h2 className="font-editorial text-4xl font-semibold max-w-lg">
                        Tu trastero tiene más valor del que crees.
                    </h2>
                    <p className="text-[var(--muted)] max-w-md">
                        Únete a NeighborLink y empieza a compartir hoy. Es gratis, es local y
                        es exactamente lo que tu barrio necesita.
                    </p>
                    <Link
                        to="/register"
                        className="rounded-full bg-[var(--accent-2)] px-8 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-95"
                    >
                        Unirme ahora
                    </Link>
                </section>
            </RevealSection>
        </div>
    );
}
