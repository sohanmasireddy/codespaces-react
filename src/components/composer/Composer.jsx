import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import imageCompression from 'browser-image-compression';
import TextareaAutosize from 'react-textarea-autosize';
import { Paperclip, Send, Square, X, Image as ImageIcon, FileText } from 'lucide-react';
import { Button } from '@carbon/react';
import { toast } from 'sonner';

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const MAX_TOTAL_FILE_SIZE = 5 * 1024 * 1024;
const MAX_TEXT_FILE_SIZE = 100 * 1024;
const ACCEPTED = {
  'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
  'application/pdf': ['.pdf'],
  'text/*': ['.txt', '.md', '.csv', '.json', '.xml', '.html', '.css', '.js', '.jsx', '.ts', '.tsx', '.py', '.rs', '.go', '.sql', '.sh'],
  'application/json': ['.json'],
};

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export default function Composer({ onSend, onStop, busy, disabled, textareaRef, initialValue = '' }) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (initialValue) setText(initialValue);
  }, [initialValue]);

  const addFiles = useCallback(async (acceptedFiles) => {
    setProcessing(true);
    try {
      const prepared = await Promise.all(acceptedFiles.map(async (original) => {
        if (original.size > MAX_FILE_SIZE) {
          throw new Error(`${original.name} exceeds the 4 MB limit`);
        }
        let file = original;
        if (file.type.startsWith('image/') && file.type !== 'image/gif') {
          file = await imageCompression(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1800,
            useWebWorker: true,
          });
        }
        const dataUrl = await readAsDataUrl(file);
        const isText = file.type.startsWith('text/') ||
          /\.(md|csv|json|xml|html|css|js|jsx|ts|tsx|py|rs|go|sql|sh)$/i.test(file.name);
        if (isText && file.size > MAX_TEXT_FILE_SIZE) {
          throw new Error(`${original.name} exceeds the 100 KB text-file limit`);
        }
        return { file, dataUrl, isText };
      }));
      const currentSize = attachments.reduce((size, item) => size + item.file.size, 0);
      const incomingSize = prepared.reduce((size, item) => size + item.file.size, 0);
      if (currentSize + incomingSize > MAX_TOTAL_FILE_SIZE) {
        throw new Error('Attachments may total no more than 5 MB');
      }
      setAttachments((current) => [...current, ...prepared].slice(0, 5));
      toast.success(`${prepared.length} file${prepared.length === 1 ? '' : 's'} attached`);
    } catch (error) {
      toast.error(error.message || 'Could not attach file');
    } finally {
      setProcessing(false);
    }
  }, []);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length) {
      toast.error('Use images, PDFs, or text files up to 4 MB each');
    }
    if (acceptedFiles.length) addFiles(acceptedFiles);
  }, [addFiles]);

  const { getRootProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: MAX_FILE_SIZE,
    noClick: true,
    noKeyboard: true,
    multiple: true,
  });

  const submit = (event) => {
    event.preventDefault();
    if (busy) {
      onStop();
      return;
    }
    if ((!text.trim() && !attachments.length) || disabled || processing) return;
    const fileParts = attachments
      .filter((item) => !item.isText)
      .map((item) => ({
        type: 'file',
        filename: item.file.name,
        mediaType: item.file.type || 'application/octet-stream',
        url: item.dataUrl,
      }));
    const textFiles = attachments.filter((item) => item.isText);
    const sendWithTextFiles = async () => {
      const fileContents = await Promise.all(textFiles.map(async (item) => ({
        name: item.file.name,
        content: await item.file.text(),
      })));
      const composedText = `${text.trim()}${fileContents.map((item) => `\n\n[Attached file: ${item.name}]\n${item.content}`).join('')}`.trim();
      onSend(composedText, fileParts);
      setText('');
      setAttachments([]);
    };
    if (textFiles.length) {
      sendWithTextFiles().catch((error) => toast.error(error.message));
    } else {
      onSend(text.trim(), fileParts);
      setText('');
      setAttachments([]);
    }
  };

  return (
    <div {...getRootProps()} className={`composer-wrap ${isDragActive ? 'composer-drag-active' : ''}`}>
      <form className="composer" onSubmit={submit}>
        {attachments.length > 0 && (
          <div className="attachment-tray">
            {attachments.map((item, index) => (
              <div className="attachment-preview" key={`${item.file.name}-${index}`}>
                {item.file.type.startsWith('image/') ? (
                  <img src={item.dataUrl} alt="" />
                ) : item.file.type === 'application/pdf' ? <FileText size={17} /> : <ImageIcon size={17} />}
                <span title={item.file.name}>{item.file.name}</span>
                <button type="button" aria-label={`Remove ${item.file.name}`} onClick={() => setAttachments((files) => files.filter((_, i) => i !== index))}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        {isDragActive && <div className="drop-overlay">Drop files to attach</div>}
        <TextareaAutosize
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          minRows={1}
          maxRows={8}
          placeholder={disabled ? 'Configure an AI provider to start chatting' : 'Message your assistant…'}
          aria-label="Message"
          disabled={disabled}
        />
        <div className="composer-footer">
          <div className="composer-tools">
            <label className="icon-button attach-button" title="Attach files">
              <Paperclip size={18} />
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.txt,.md,.csv,.json,.xml,.html,.css,.js,.jsx,.ts,.tsx,.py,.rs,.go,.sql,.sh"
                onChange={(event) => {
                  if (event.target.files?.length) addFiles(Array.from(event.target.files));
                  event.target.value = '';
                }}
                aria-label="Attach files"
                disabled={disabled || processing || attachments.length >= 5}
              />
            </label>
            <span className="composer-hint">Enter to send · Shift + Enter for a new line</span>
          </div>
          <Button
            type="submit"
            kind={busy ? 'danger' : 'primary'}
            size="sm"
            hasIconOnly
            renderIcon={busy ? Square : Send}
            iconDescription={busy ? 'Stop generating' : 'Send message'}
            disabled={!busy && (disabled || processing || (!text.trim() && !attachments.length))}
            className="send-button"
          />
        </div>
      </form>
      <div className="composer-disclaimer">
        AI can make mistakes. Check important information.
      </div>
    </div>
  );
}
