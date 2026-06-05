import type { Message } from '../../types';

const SYSTEM_SENDER_ID = '00000000-0000-0000-0000-000000000000';

interface MessageBubbleProps {
    message: Message;
    isMe: boolean;
}

export default function MessageBubble({ message, isMe }: MessageBubbleProps) {
    if (message.sender_id === SYSTEM_SENDER_ID) return null;

    return (
        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${isMe
                    ? 'bg-[var(--accent-2)] text-white rounded-br-sm'
                    : 'bg-white border border-[var(--border)] text-[var(--text)] rounded-bl-sm'
                    }`}
            >
                <p>{message.content}</p>
                <p className={`text-xs mt-1 ${isMe ? 'text-white/70' : 'text-[var(--muted)]'}`}>
                    {new Date(message.created_at).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </p>
            </div>
        </div>
    );
}