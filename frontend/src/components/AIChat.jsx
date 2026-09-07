import { useState } from 'react';
import { sendAIMessage } from '../utils/ai';
import { Bot, Send, Sparkles } from 'lucide-react';
import '../pages/OperationsPage.css';

export default function AIChat() {
  const [input, setInput] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async (event) => {
    event.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    try {
      const aiReply = await sendAIMessage(input.trim());
      setReply(aiReply);
      setInput('');
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="operations-page ai-page">
      <header className="operations-page-header"><div><p className="eyebrow">Workspace / Intelligence</p><h1>AI workspace</h1><p>Ask about production activity, material flow, or the next action to take.</p></div></header>
      <section className="ai-thread">{reply ? <div className="ai-reply"><span className="ai-reply-label">Assistant response</span>{reply}</div> : <div className="ai-empty"><Sparkles size={25} /><strong>Ready when you are</strong><p>Start with a question about your manufacturing operation.</p></div>}</section>
      {error && <p className="operation-alert" role="alert">{error}</p>}
      <form className="ai-composer" onSubmit={handleSend}><Bot aria-hidden="true" color="var(--teal)" size={18} /><input aria-label="Message for AI assistant" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question about the operation..." /><button disabled={loading || !input.trim()} type="submit"><Send size={15} /><span>{loading ? 'Thinking...' : 'Send'}</span></button></form>
    </main>
  );
}
