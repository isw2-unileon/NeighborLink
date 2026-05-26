interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    loading?: boolean;
    variant?: 'primary' | 'ghost';
}

export default function Button({
    children,
    loading = false,
    variant = 'primary',
    disabled,
    ...props
}: ButtonProps) {
    const base = 'w-full rounded-full px-5 py-2.5 text-sm font-semibold tracking-wide transition focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    const variants = {
        primary: 'bg-[var(--accent)] text-white shadow-sm hover:brightness-95',
        ghost: 'border border-[var(--border)] bg-white text-[var(--text)] hover:bg-[var(--surface-strong)]',
    };

    return (
        <button
            disabled={disabled || loading}
            className={`${base} ${variants[variant]}`}
            {...props}
        >
            {loading ? 'Cargando…' : children}
        </button>
    );
}