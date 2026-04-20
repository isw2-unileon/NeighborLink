interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
}

export default function Input({ label, error, id, ...props }: InputProps) {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');

    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
                {label}
            </label>
            <input
                id={inputId}
                className={`w-full rounded-md border px-3 py-2 text-sm outline-none transition
          focus:ring-2 focus:ring-teal-600 focus:border-teal-600
          ${error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`}
                {...props}
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    );
}