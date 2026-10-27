"use client";

import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { classifyMedia } from "@/lib/media";

export function MarkdownView({ content }: { content: string }) {
  return (
    <div className="cjk markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ href, children }) => {
            if (!href || !/^https?:\/\//.test(href)) return <span>{children}</span>;
            return (
              <a href={href} rel="nofollow noopener noreferrer" target="_blank">
                {children}
              </a>
            );
          },
          img: ({ src, alt }) => {
            const media = typeof src === "string" ? classifyMedia(src) : null;
            if (!media) return <span>{alt}</span>;
            if (media.kind === "video") {
              return (
                <span className="media-embed">
                  <video src={media.src} controls preload="metadata" playsInline aria-label={alt || "视频"} />
                </span>
              );
            }
            if (media.kind === "embed") {
              return (
                <span className="media-embed">
                  <iframe
                    src={media.src}
                    title={alt || media.title}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer"
                    sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                  />
                </span>
              );
            }
            return (
              // eslint-disable-next-line @next/next/no-img-element -- 用户贴的是任意网络图片，没法预先配置 next/image 的域名
              <img src={media.src} alt={alt ?? ""} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
