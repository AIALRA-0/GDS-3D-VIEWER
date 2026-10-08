import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const elements = ["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "em", "strong", "del", "code", "pre", "blockquote", "hr", "br", "table", "thead", "tbody", "tr", "th", "td", "a", "sup", "input"];

export function Markdown({ content }: { content: string }) {
  return <div className="markdown-content">
    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml allowedElements={elements} components={{
      // Model links remain readable without introducing navigation or tracking
      a: ({ children }) => <span>{children}</span>,
      table: ({ children }) => <div className="markdown-table"><table>{children}</table></div>,
      input: ({ checked }) => <input type="checkbox" checked={checked ?? false} readOnly disabled />,
    }}>{content}</ReactMarkdown>
  </div>;
}
