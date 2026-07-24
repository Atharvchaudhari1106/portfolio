import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { aiApi } from '../lib/api';

interface Message {
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
  "Why is Mule Account A suspicious?",
  "Show circular routes in the graph",
  "What accounts have the highest risk?",
  "Explain structuring detection",
  "What are the recommended actions for high-risk accounts?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (question?: string) => {
    const text = question || input.trim();
    if (!text) return;

    const userMessage: Message = { role: 'user', content: text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

      const response = await aiApi.chat({
        question: text,
        conversation_history: history,
      });

      const aiMessage: Message = {
        role: 'ai',
        content: response.data.answer,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      const errorMessage: Message = {
        role: 'ai',
        content: '⚠️ Failed to get AI response. Make sure Ollama is running.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>AI Investigator</h1>
        <p>Ask questions about suspicious accounts and transactions</p>
      </div>

      <div className="glass-card chat-container">
        {/* Messages */}
        <div className="chat-messages">
          {messages.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '3rem',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16,
                background: 'var(--gradient-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '1rem', boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)',
              }}>
                <Sparkles size={28} color="white" />
              </div>
              <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                FinTrace AI Investigator
              </h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: 400 }}>
                Ask me anything about suspicious accounts, transaction patterns, or AML detection results.
              </p>

              {/* Suggested Questions */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '6px 16px' }}
                    onClick={() => sendMessage(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`chat-bubble ${msg.role === 'user' ? 'user' : 'ai'}`}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginBottom: 6, fontSize: '0.75rem',
                color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)',
              }}>
                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                {msg.role === 'user' ? 'You' : 'AI Investigator'}
                <span style={{ marginLeft: 'auto' }}>
                  {msg.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
            </div>
          ))}

          {loading && (
            <div className="chat-bubble ai">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bot size={14} />
                <span style={{ color: 'var(--text-muted)' }}>Thinking...</span>
                <div style={{
                  display: 'flex', gap: 4,
                }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--accent-indigo)',
                      animation: `pulse-glow 1.4s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="chat-input-bar">
          <input
            className="input-field"
            placeholder="Ask about suspicious activity..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            disabled={loading}
          />
          <button
            className="btn-primary"
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            style={{ padding: '10px 20px' }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
