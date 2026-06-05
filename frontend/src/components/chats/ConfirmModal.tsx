interface ConfirmModalProps {
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel?: string;
    loading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmModal({
    title,
    description,
    confirmLabel,
    cancelLabel = 'Cancelar',
    loading = false,
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 flex flex-col gap-5">
                <div>
                    <h2 className="text-base font-bold text-gray-900 mb-1">{title}</h2>
                    <p className="text-sm text-gray-500">{description}</p>
                </div>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50"
                    >
                        {confirmLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
