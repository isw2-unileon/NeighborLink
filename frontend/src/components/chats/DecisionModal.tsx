interface DecisionModalProps {
    onClose: () => void;
    onAccept: () => void;
    onReject: () => void;
    loading: boolean;
}

export default function DecisionModal({
    onClose,
    onAccept,
    onReject,
    loading,
}: DecisionModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 flex flex-col gap-5">
                <div>
                    <h2 className="text-base font-bold text-gray-900 mb-1">Tomar una decisión</h2>
                    <p className="text-sm text-gray-500">¿Deseas aceptar o rechazar esta solicitud?</p>
                </div>
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <span className="text-amber-500 text-base mt-0.5">⚠️</span>
                    <p className="text-xs text-amber-700 leading-relaxed">Esta decisión no se podrá deshacer después.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onAccept}
                        disabled={loading}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50"
                    >
                        Aceptar
                    </button>
                    <button
                        type="button"
                        onClick={onReject}
                        disabled={loading}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50"
                    >
                        Rechazar
                    </button>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="text-xs text-gray-400 hover:text-gray-600 text-center transition"
                >
                    Cancelar
                </button>
            </div>
        </div>
    );
}
