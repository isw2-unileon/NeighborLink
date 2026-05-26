interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
}

export default function Input({ label, error, id, ...props }: InputProps) {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');

    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={inputId} className="text-sm font-medium text-[var(--muted)]">
                {label}
            </label>
            <input
                id={inputId}
                className={`w-full rounded-2xl border px-4 py-2.5 text-sm outline-none transition
          focus:ring-2 focus:ring-[var(--ring)] focus:border-[var(--accent)]
          ${error ? 'border-red-400 bg-red-50' : 'border-[var(--border)] bg-white'}`}
                {...props}
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    );
}