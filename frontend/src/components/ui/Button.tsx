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
    const base = 'w-full rounded-md px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';
    const variants = {
        primary: 'bg-teal-700 text-white hover:bg-teal-800',
        ghost: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
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