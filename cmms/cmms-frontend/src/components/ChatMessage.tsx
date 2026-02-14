import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cx } from './ui';

interface ChatMessageProps {
    role: 'user' | 'assistant';
    content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
    const isUser = role === 'user';

    return (
        <div className={cx(
            "flex w-full mb-4",
            isUser ? "justify-end" : "justify-start"
        )}>
            <div className={cx(
                "max-w-[85%] rounded-2xl p-4 shadow-sm transition-all",
                isUser
                    ? "bg-blue-600 text-white rounded-tr-none"
                    : "bg-zinc-800 text-zinc-100 border border-white/5 rounded-tl-none"
            )}>
                <div className={cx(
                    "prose prose-sm max-w-none break-words",
                    isUser ? "prose-invert" : "prose-zinc prose-invert"
                )}>
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            // Manual styling for common elements since @tailwindcss/typography might be missing
                            p: ({ children }: any) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                            ul: ({ children }: any) => <ul className="list-disc ml-4 mb-2 space-y-1">{children}</ul>,
                            ol: ({ children }: any) => <ol className="list-decimal ml-4 mb-2 space-y-1">{children}</ol>,
                            li: ({ children }: any) => <li className="text-sm">{children}</li>,
                            h1: ({ children }: any) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                            h2: ({ children }: any) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                            h3: ({ children }: any) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                            code: ({ children }: any) => <code className="bg-black/30 px-1 rounded font-mono text-xs">{children}</code>,
                            pre: ({ children }: any) => <pre className="bg-black/30 p-3 rounded-lg overflow-x-auto mb-2 text-xs font-mono">{children}</pre>,
                            table: ({ children }: any) => (
                                <div className="overflow-x-auto mb-2">
                                    <table className="min-w-full border-collapse border border-white/10 text-xs">
                                        {children}
                                    </table>
                                </div>
                            ),
                            th: ({ children }: any) => <th className="border border-white/10 p-2 bg-white/5 font-bold text-left">{children}</th>,
                            td: ({ children }: any) => <td className="border border-white/10 p-2">{children}</td>,
                            blockquote: ({ children }: any) => <blockquote className="border-l-4 border-white/20 pl-4 italic mb-2 text-zinc-400">{children}</blockquote>,
                        }}
                    >
                        {content}
                    </ReactMarkdown>
                </div>

                <div className={cx(
                    "mt-2 text-[10px] font-medium uppercase tracking-widest opacity-40",
                    isUser ? "text-right" : "text-left"
                )}>
                    {isUser ? "Tu" : "AI Assistant"}
                </div>
            </div>
        </div>
    );
}
