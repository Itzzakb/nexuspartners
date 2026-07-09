import { useEffect, useRef, useState } from 'react';
import { Send, ImagePlus } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import { chatApi, uploadFile } from '@/lib/api';
import type { Conversation, ChatMessage } from '@/types/phase6';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

export default function Chat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    const data = await chatApi.conversations();
    setConversations(data.conversations);
    if (!activeId && data.conversations.length) {
      setActiveId(data.conversations[0].id);
    }
  };

  useEffect(() => {
    loadConversations().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('accessToken');
    const s = io(SOCKET_URL || undefined, { auth: { token }, transports: ['websocket', 'polling'] });
    s.on('chat:message', ({ message, conversationId }) => {
      if (conversationId === activeId) {
        setMessages((prev) => [...prev, message]);
      }
      loadConversations();
    });
    socketRef.current = s;
    return () => { s.disconnect(); };
  }, [user, activeId]);

  useEffect(() => {
    if (!activeId) return;
    socketRef.current?.emit('join:conversation', activeId);
    chatApi.messages(activeId).then((data) => {
      setMessages(data.messages);
      chatApi.markRead(activeId);
    });
    return () => {
      socketRef.current?.emit('leave:conversation', activeId);
    };
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!userQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      chatApi.searchUsers(userQuery).then((d) => setSearchResults(d.users)).catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [userQuery]);

  const startChat = async (participantId: string) => {
    const data = await chatApi.start({ participantId });
    setUserQuery('');
    setSearchResults([]);
    await loadConversations();
    setActiveId(data.conversation.id);
  };

  const send = async () => {
    if (!activeId || !text.trim()) return;
    const msg = text.trim();
    setText('');
    await chatApi.send(activeId, { text: msg });
  };

  const sendImage = async (file: File) => {
    if (!activeId) return;
    const uploaded = await uploadFile(file, 'chat');
    await chatApi.send(activeId, { imageUrl: uploaded.url, imagePublicId: uploaded.publicId });
  };

  const activeConv = conversations.find((c) => c.id === activeId);
  const otherParticipants = activeConv?.participants.filter((p) => p.id !== user?.id) || [];

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <aside className="np-card flex w-72 shrink-0 flex-col overflow-hidden">
        <div className="border-b border-border p-3">
          <input className="np-input text-sm" placeholder="Start chat with…" value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)} />
          {searchResults.length > 0 && (
            <div className="mt-2 max-h-32 overflow-y-auto rounded border border-border bg-surface">
              {searchResults.map((u) => (
                <button key={u.id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => startChat(u.id)}>
                  {u.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-sm text-body">Loading…</p>
          ) : conversations.map((c) => {
            const others = c.participants.filter((p) => p.id !== user?.id);
            const label = c.title || others.map((p) => p.name).join(', ') || 'Chat';
            return (
              <button key={c.id} type="button"
                className={`block w-full border-b border-border px-4 py-3 text-left text-sm hover:bg-muted ${activeId === c.id ? 'bg-muted' : ''}`}
                onClick={() => setActiveId(c.id)}>
                <p className="font-medium text-heading">{label}</p>
                <p className="truncate text-xs text-body">{c.lastMessagePreview || 'No messages'}</p>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="np-card flex min-w-0 flex-1 flex-col">
        {activeId ? (
          <>
            <div className="border-b border-border px-4 py-3">
              <p className="font-medium">{otherParticipants.map((p) => p.name).join(', ') || 'Chat'}</p>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m) => {
                const mine = m.senderId === user?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${mine ? 'bg-primary text-white' : 'bg-muted text-heading'}`}>
                      {!mine && <p className="mb-1 text-xs opacity-70">{m.senderName}</p>}
                      {m.imageUrl ? (
                        <img src={m.imageUrl} alt="" className="max-h-48 rounded" />
                      ) : (
                        <p>{m.text}</p>
                      )}
                      <p className={`mt-1 text-xs ${mine ? 'text-white/70' : 'text-body'}`}>
                        {new Date(m.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            <div className="flex gap-2 border-t border-border p-3">
              <label className="np-btn-secondary cursor-pointer">
                <ImagePlus className="h-4 w-4" />
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => e.target.files?.[0] && sendImage(e.target.files[0])} />
              </label>
              <input className="np-input flex-1" placeholder="Type a message…" value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())} />
              <button type="button" className="np-btn-primary" onClick={send}>
                <Send className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-body">
            Select or start a conversation
          </div>
        )}
      </div>
    </div>
  );
}
