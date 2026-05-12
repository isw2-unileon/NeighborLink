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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-xl shadow-lg z-50 text-sm font-medium">
            {message}
        </div>
    );
}