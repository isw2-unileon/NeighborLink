import { useEffect } from 'react';

interface Props {
    message: string;
    onClose: () => void;
}

export default function Toast({ message, onClose }: Props) {
    useEffect(() => {
        const t = setTimeout(onClose, 4000);
        return () => clearTimeout(t);
    }, [onClose]);

    return (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--accent-2)] px-6 py-3 text-sm font-medium text-white shadow-lg">
            {message}
        </div>
    );
}