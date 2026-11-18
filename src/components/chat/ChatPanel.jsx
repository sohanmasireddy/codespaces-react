import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { ArrowDown, Sparkles } from 'lucide-react';
import { Button, InlineNotification } from '@carbon/react';
import { toast } from 'sonner';
import { saveConversation } from '../../lib/database';
import MessageList from './MessageList';
import Composer from '../composer/Composer';

const starters = [
  { title: 'Explain a concept', prompt: 'Explain a complex idea in simple terms.' },
  { title: 'Write something', prompt: 'Help me draft a clear, thoughtful message about…' },
  { title: 'Explore an idea', prompt: 'Help me think through an idea I have.' },
  { title: 'Debug some code', prompt: 'Help me understand and fix this code:\n\n' },
];

function getMessageText(message) {
  return (message.parts || []).filter((part) => part.type === 'text').map((part) => part.text).join('\n');
}

export default function ChatPanel({ conversation, settings, config, onSave, composerRef: externalComposerRef }) {
  const [draft, setDraft] = useState('');
  const [showLatest, setShowLatest] = useState(false);
  const virtuosoRef = useRef(null);
  const internalComposerRef = useRef(null);
  const textareaRef = externalComposerRef || internalComposerRef;
  const scrollTimer = useRef(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: {
          model: settings.model || undefined,
          temperature: settings.temperature,
          maxOutputTokens: settings.maxOutputTokens,
          systemPrompt: settings.systemPrompt,
          webSearch: settings.webSearch,
        },
      }),
    [settings.model, settings.temperature, settings.maxOutputTokens, settings.systemPrompt, settings.webSearch],
  );

  const {
    messages,
    sendMessage,
    status,
    stop,
    regenerate,
    setMessages,
    error,
  } = useChat({
    id: conversation.id,
    messages: conversation.messages || [],
    transport,
    throttle: 50,
    onError: (requestError) => toast.error(requestError.message || 'The assistant could not respond'),
  });
  const busy = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      if (messages.length) {
        saveConversation({
          ...conversation,
          title: conversation.title === 'New conversation'
            ? (getMessageText(messages.find((message) => message.role === 'user') || {}).slice(0, 60) || conversation.title)
            : conversation.title,
          messages,
        }).then(onSave).catch(() => toast.error('Could not save this conversation'));
      }
    }, busy ? 700 : 0);
    return () => clearTimeout(scrollTimer.current);
  }, [messages, busy, conversation.id, conversation.title, conversation.createdAt, onSave]);

  const submit = (text, files = []) => {
    if (busy) return;
    sendMessage({
      text,
      files,
      metadata: { createdAt: Date.now() },
    });
  };

  const editMessage = (message) => {
    const messageIndex = messages.findIndex((item) => item.id === message.id);
    if (messageIndex < 0) return;
    setDraft(getMessageText(message));
    setMessages(messages.slice(0, messageIndex));
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const reactToMessage = (messageId, reaction) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? { ...message, metadata: { ...message.metadata, feedback: reaction } }
          : message,
      ),
    );
    toast.success(reaction === 'up' ? 'Thanks for your feedback' : 'Feedback saved');
  };

  const scrollToLatest = () => {
    virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, align: 'end', behavior: 'smooth' });
    setShowLatest(false);
  };

  return (
    <main className="chat-main">
      {!config.configured && (
        <div className="provider-notice" role="status">
          <Sparkles size={16} />
          <span>
            Add <code>AI_BASE_URL</code>, <code>AI_MODEL</code>, and <code>AI_API_KEY</code> as Cloudflare secrets to enable real responses.
            No demo responses are generated.
          </span>
        </div>
      )}
      {error && (
        <InlineNotification
          kind="error"
          title="Request failed"
          subtitle="Check your provider configuration or connection, then retry."
          lowContrast
          hideCloseButton={false}
          actions={<Button kind="ghost" size="sm" onClick={() => regenerate()}>Retry</Button>}
          className="chat-error"
        />
      )}
      {status === 'submitted' && (
        <div className="streaming-indicator" role="status">
          <span className="streaming-dots"><i /><i /><i /></span>
          <span>Preparing a response…</span>
        </div>
      )}
      {messages.length === 0 ? (
        <div className="welcome-content">
          <div className="welcome-mark"><Sparkles size={22} /></div>
          <p className="eyebrow">YOUR THINKING PARTNER</p>
          <h1>What can I help<br />you with today?</h1>
          <p className="welcome-description">Ask a question, explore an idea, or bring a problem to solve.</p>
          <div className="starter-grid">
            {starters.map((starter) => (
              <button
                type="button"
                key={starter.title}
                onClick={() => {
                  if (config.configured) submit(starter.prompt);
                  else toast.error('Configure the AI provider to start a conversation');
                }}
              >
                <span>{starter.title}</span>
                <span className="starter-prompt">{starter.prompt.split('\n')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <MessageList
            messages={messages}
            status={status}
            virtuosoRef={virtuosoRef}
            onRegenerate={() => regenerate()}
            onEdit={editMessage}
            onReact={reactToMessage}
            onAtBottomChange={(atBottom) => setShowLatest(!atBottom)}
          />
          {showLatest && (
            <Button className="scroll-latest" kind="tertiary" size="sm" renderIcon={ArrowDown} onClick={scrollToLatest}>
              Latest message
            </Button>
          )}
        </>
      )}
      <Composer
        onSend={submit}
        onStop={stop}
        busy={busy}
        disabled={!config.configured}
        textareaRef={textareaRef}
        initialValue={draft}
      />
    </main>
  );
}
