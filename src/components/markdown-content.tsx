"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { Components } from "react-markdown"

const components: Components = {
  strong: ({ children }) => (
    <strong className="font-bold text-cyan-100">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-fuchsia-200">{children}</em>
  ),
  code: ({ children, className }) => {
    // 블록 코드 (pre > code)
    if (className) {
      return (
        <code className="block rounded-lg border border-white/10 bg-black/60 px-4 py-3 text-sm text-emerald-200">
          {children}
        </code>
      )
    }
    // 인라인 코드
    return (
      <code className="rounded-md border border-white/10 bg-black/40 px-1.5 py-0.5 text-[13px] text-emerald-200">
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto">{children}</pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-cyan-400/40 pl-3 italic text-zinc-400">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target={href?.startsWith("/") ? undefined : "_blank"}
      rel={href?.startsWith("/") ? undefined : "noopener noreferrer"}
      className="text-cyan-300 underline underline-offset-2 transition-colors hover:text-cyan-200"
    >
      {children}
    </a>
  ),
  del: ({ children }) => (
    <del className="text-zinc-500 line-through">{children}</del>
  ),
  ul: ({ children }) => (
    <ul className="my-1 ml-4 list-disc space-y-0.5 text-zinc-200">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1 ml-4 list-decimal space-y-0.5 text-zinc-200">{children}</ol>
  ),
  li: ({ children }) => <li className="text-zinc-200">{children}</li>,
  p: ({ children }) => <p className="my-0.5">{children}</p>,
}

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="markdown-content whitespace-pre-wrap text-sm text-zinc-100">
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml allowedElements={[
        "p", "strong", "em", "code", "pre", "blockquote", "a", "del",
        "ul", "ol", "li", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6",
        "table", "thead", "tbody", "tr", "th", "td", "input",
      ]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
