import { useMemo, useState } from 'react';
import { lazy, Suspense } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Copy, ThumbsDown, ThumbsUp, RotateCcw, Pencil, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Tooltip } from '@carbon/react';
import MessageContent from '../markdown/MessageContent';

const Lightbox = lazy(() => import('yet-another-react-lightbox'));

function messageText(message) {
  return (message.parts || [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}

function MessageRow({ message, index, messages, status, onRegenerate, onEdit, onReact }) {
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [menuOpen, setMenuOpen] = useState(false);
  const images = useMemo(
    () =>
      (message.parts || [])
        .filter((part) => part.type === 'file' && part.mediaType?.startsWith('image/'))
        .map((part) => ({ src: part.url, alt: part.filename || 'Attached image' })),
    [message.parts],
  );
  const text = messageText(message);
  const searchResults = (message.parts || [])
    .filter((part) => part.type === 'tool-web_search' && part.state === 'output-available')
    .flatMap((part) => Array.isArray(part.output?.results) ? part.output.results : []);
  const isUser = message.role === 'user';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Message copied');
    } catch {
      toast.error('Could not copy message');
    }
  };

  return (
    <article className={`message-row ${isUser ? 'message-user' : 'message-assistant'}`}>
      {!isUser && <div className="assistant-mark" aria-hidden="true">✳</div>}
      <div className="message-body">
        {images.length > 0 && (
          <div className="message-images">
            {images.map((image, imageIndex) => (
              <button
                type="button"
                className="message-image-button"
                key={`${image.src.slice(0, 40)}-${imageIndex}`}
                onClick={() => setLightboxIndex(imageIndex)}
                aria-label={`View ${image.alt}`}
              >
                <img src={image.src} alt={image.alt} loading="lazy" />
              </button>
            ))}
          </div>
        )}
        {text && (
          <div className={isUser ? 'user-bubble' : 'assistant-content'}>
            {isUser ? <p>{text}</p> : (
              <MessageContent isAnimating={status === 'streaming' && index === messages.length - 1}>
                {text}
              </MessageContent>
            )}
          </div>
        )}
        {(message.parts || [])
          .filter((part) => part.type === 'file' && !part.mediaType?.startsWith('image/'))
          .map((part, fileIndex) => (
            <div className="file-chip" key={`${part.filename}-${fileIndex}`}>
              <span className="file-chip-icon">↗</span>
              <span>{part.filename || 'Attachment'}</span>
            </div>
          ))}
        {searchResults.length > 0 && (
          <section className="search-sources" aria-label="Web search sources">
            <div className="search-sources-heading"><span className="source-indicator" /> DuckDuckGo search · {searchResults.length} sources</div>
            <div className="search-source-list">
              {searchResults.map((result, sourceIndex) => {
                let safeUrl = '';
                try {
                  const parsed = new URL(result.url);
                  if (parsed.protocol === 'https:' || parsed.protocol === 'http:') safeUrl = parsed.href;
                } catch {
                  safeUrl = '';
                }
                return safeUrl ? (
                  <a key={`${safeUrl}-${sourceIndex}`} href={safeUrl} target="_blank" rel="noopener noreferrer">
                    <strong>{result.title || safeUrl}</strong>
                    <span>{result.content}</span>
                  </a>
                ) : null;
              })}
            </div>
          </section>
        )}
        {!isUser && (
          <div className="message-actions" aria-label="Assistant message actions">
            <Tooltip label="Copy response">
              <Button kind="ghost" size="sm" hasIconOnly renderIcon={Copy} iconDescription="Copy response" onClick={copy} />
            </Tooltip>
            <Tooltip label="Helpful">
              <Button kind="ghost" size="sm" hasIconOnly renderIcon={ThumbsUp} iconDescription="Helpful" onClick={() => onReact(message.id, 'up')} />
            </Tooltip>
            <Tooltip label="Not helpful">
              <Button kind="ghost" size="sm" hasIconOnly renderIcon={ThumbsDown} iconDescription="Not helpful" onClick={() => onReact(message.id, 'down')} />
            </Tooltip>
            {index === messages.length - 1 && status === 'ready' && (
              <Tooltip label="Regenerate response">
                <Button kind="ghost" size="sm" hasIconOnly renderIcon={RotateCcw} iconDescription="Regenerate response" onClick={onRegenerate} />
              </Tooltip>
            )}
            {index === messages.length - 1 && messages[index - 1]?.role === 'user' && (
              <div className="message-more-wrap">
                <Button
                  kind="ghost"
                  size="sm"
                  hasIconOnly
                  renderIcon={MoreHorizontal}
                  iconDescription="More message actions"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-expanded={menuOpen}
                />
                {menuOpen && (
                  <div className="message-more-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => { copy(); setMenuOpen(false); }}>
                      <Copy size={14} /> Copy response
                    </button>
                    <button type="button" role="menuitem" onClick={() => { onRegenerate(); setMenuOpen(false); }}>
                      <RotateCcw size={14} /> Regenerate
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {isUser && (
          <div className="message-actions user-message-actions">
            <span>{new Date(message.metadata?.createdAt || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
            <Button kind="ghost" size="sm" hasIconOnly renderIcon={Copy} iconDescription="Copy message" onClick={copy} />
            <Button kind="ghost" size="sm" hasIconOnly renderIcon={Pencil} iconDescription="Edit message" onClick={() => onEdit(message)} />
          </div>
        )}
      </div>
      {lightboxIndex >= 0 && (
        <Suspense fallback={null}>
          <Lightbox
            open
            close={() => setLightboxIndex(-1)}
            index={lightboxIndex}
            slides={images}
          />
        </Suspense>
      )}
    </article>
  );
}

export default function MessageList({
  messages,
  status,
  onRegenerate,
  onEdit,
  onReact,
  virtuosoRef,
  onAtBottomChange,
}) {
  return (
    <Virtuoso
      ref={virtuosoRef}
      className="message-list"
      data={messages}
      followOutput="smooth"
      alignToBottom
      atBottomStateChange={onAtBottomChange}
      increaseViewportBy={{ top: 500, bottom: 700 }}
      itemContent={(index, message) => (
        <MessageRow
          key={message.id}
          index={index}
          message={message}
          messages={messages}
          status={status}
          onRegenerate={onRegenerate}
          onEdit={onEdit}
          onReact={onReact}
        />
      )}
      components={{
        Header: () => <div className="message-list-top-space" />,
      }}
    />
  );
}
