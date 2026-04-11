/**
 * CeoChat — pixel RPG styled streaming chat with CEO agent.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

export function CeoChat() {
  const { companyId } = useParams<{ companyId: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history
  useEffect(() => {
    if (!companyId) return;
    fetch(`${API}/company/${companyId}/chat/messages`)
      .then(r => r.json())
      .then(data => setMessages(data ?? []))
      .catch(() => {});
  }, [companyId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamBuffer]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !companyId || streaming) return;

    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setStreaming(true);
    setStreamBuffer('');

    try {
      const res = await fetch(`${API}/company/${companyId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n');

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'chunk') {
                fullContent += (fullContent ? ' ' : '') + data.content;
                setStreamBuffer(fullContent);
              } else if (data.type === 'done') {
                fullContent = data.content;
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: fullContent }]);
      setStreamBuffer('');
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'CONNECTION ERROR — CEO unavailable.' }]);
    } finally {
      setStreaming(false);
    }
  }, [input, companyId, streaming]);

  const clearChat = async () => {
    if (!companyId) return;
    await fetch(`${API}/company/${companyId}/chat`, { method: 'DELETE' });
    setMessages([]);
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      fontFamily: '"Press Start 2P", monospace', color: '#c0c0c0',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderBottom: '2px solid #1a1a3a',
      }}>
        <span style={{ fontSize: 11, color: '#00ffd5' }}>CEO DIRECT LINE</span>
        <button
          onClick={clearChat}
          style={{
            background: 'transparent', color: '#666', border: '1px solid #333',
            padding: '4px 8px', fontFamily: 'inherit', fontSize: 7, cursor: 'pointer',
          }}
        >
          CLEAR
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflow: 'auto', padding: 16,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {messages.length === 0 && !streaming && (
          <div style={{ textAlign: 'center', color: '#333', fontSize: 8, padding: 40 }}>
            TYPE A MESSAGE TO CONSULT THE CEO
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {streaming && streamBuffer && (
          <MessageBubble message={{ role: 'assistant', content: streamBuffer + ' _' }} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
        style={{
          display: 'flex', gap: 8, padding: 12,
          borderTop: '2px solid #1a1a3a',
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={streaming ? 'CEO is thinking...' : 'Message the CEO...'}
          disabled={streaming}
          style={{
            flex: 1, background: '#0a0a1a', border: '2px solid #333',
            color: '#00ffd5', padding: '8px 12px',
            fontFamily: '"VT323", monospace', fontSize: 14, outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          style={{
            background: streaming ? '#333' : '#00ffd5',
            color: '#0a0a1a', border: '2px solid #00ffd5',
            padding: '8px 16px', fontFamily: 'inherit', fontSize: 8,
            cursor: streaming ? 'wait' : 'pointer',
          }}
        >
          SEND
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '80%',
      padding: '10px 14px',
      border: `2px solid ${isUser ? '#333' : '#00ffd533'}`,
      background: isUser ? '#1a1a3a' : '#0a0a1a',
    }}>
      <div style={{ fontSize: 7, color: isUser ? '#666' : '#00ffd5', marginBottom: 4 }}>
        {isUser ? 'YOU' : 'CEO'}
      </div>
      <div style={{
        fontSize: 10, fontFamily: '"VT323", monospace',
        lineHeight: '1.5', whiteSpace: 'pre-wrap',
        color: isUser ? '#c0c0c0' : '#e0e0e0',
      }}>
        {message.content}
      </div>
    </div>
  );
}
