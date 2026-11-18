import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import { math } from '@streamdown/math';
import { mermaid } from '@streamdown/mermaid';
import 'streamdown/styles.css';
import 'katex/dist/katex.min.css';

const plugins = { code, math, mermaid };

export default function StreamdownContent({ children, isAnimating }) {
  return (
    <Streamdown
      className="message-markdown"
      plugins={plugins}
      isAnimating={isAnimating}
      lineNumbers
      controls={{
        code: { copy: true, download: true },
        table: { copy: true, download: true },
        mermaid: { copy: true, download: true, fullscreen: true, panZoom: true },
      }}
      parseIncompleteMarkdown
      skipHtml
      linkSafety={{ enabled: true, mode: 'modal' }}
    >
      {children}
    </Streamdown>
  );
}
