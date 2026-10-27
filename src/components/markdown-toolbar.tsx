"use client";

import { useState, type RefObject } from "react";
import { Bold, Code, Heading2, Image as ImageIcon, Italic, Link as LinkIcon, List, ListOrdered, Quote, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { insertBlock, insertInline, prefixLines, wrapSelection, type Edit } from "@/lib/markdown-edit";
import { classifyMedia, isEmbeddableVideo, markdownUrl, parseHttpUrl } from "@/lib/media";

type PanelKind = "link" | "image" | "video";

const PANELS: Record<PanelKind, { title: string; urlLabel: string; placeholder: string; hint: string; extraLabel?: string; extraPlaceholder?: string }> = {
  link: { title: "插入链接", urlLabel: "链接地址", placeholder: "https://", hint: "只支持 http 或 https 开头的地址。" },
  image: {
    title: "插入图片",
    urlLabel: "图片地址",
    placeholder: "https://example.com/photo.jpg",
    hint: "粘贴图片的网络地址。暂不支持直接上传。",
    extraLabel: "图片说明（选填）",
    extraPlaceholder: "给看不到图片的人读的一句话",
  },
  video: {
    title: "插入视频",
    urlLabel: "视频地址",
    placeholder: "https://www.bilibili.com/video/BV…",
    hint: "支持哔哩哔哩、YouTube 链接，以及 mp4、webm 等视频文件的直链。",
  },
};

export function applyShortcut(event: React.KeyboardEvent<HTMLTextAreaElement>, run: (action: "bold" | "italic" | "link") => void) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return false;
  const action = ({ b: "bold", i: "italic", k: "link" } as const)[event.key.toLowerCase() as "b" | "i" | "k"];
  if (!action) return false;
  event.preventDefault();
  run(action);
  return true;
}

export function MarkdownToolbar({
  textareaRef,
  value,
  onEdit,
  disabled,
  panel,
  setPanel,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onEdit: (edit: Edit) => void;
  disabled: boolean;
  panel: PanelKind | null;
  setPanel: (panel: PanelKind | null) => void;
}) {
  const [url, setUrl] = useState("");
  const [extra, setExtra] = useState("");
  const [error, setError] = useState("");

  function selection() {
    const el = textareaRef.current;
    return { start: el?.selectionStart ?? value.length, end: el?.selectionEnd ?? value.length };
  }

  function run(action: string) {
    const { start, end } = selection();
    if (action === "bold") onEdit(wrapSelection(value, start, end, "**", "**", "加粗文字"));
    if (action === "italic") onEdit(wrapSelection(value, start, end, "*", "*", "斜体文字"));
    if (action === "heading") onEdit(prefixLines(value, start, end, () => "## ", (line) => /^#{1,6}\s/.test(line)));
    if (action === "quote") onEdit(prefixLines(value, start, end, () => "> ", (line) => /^>/.test(line)));
    if (action === "ul") onEdit(prefixLines(value, start, end, () => "- ", (line) => /^[-*+]\s/.test(line)));
    if (action === "ol") onEdit(prefixLines(value, start, end, (index) => `${index + 1}. `, (line) => /^\d+\.\s/.test(line)));
    if (action === "code") {
      const selected = value.slice(start, end);
      if (selected.includes("\n")) {
        const snippet = `\`\`\`\n${selected}\n\`\`\``;
        onEdit(insertBlock(value, start, end, snippet, 4, 4 + selected.length));
      } else if (!selected && value.slice(0, start).split("\n").pop() === "") {
        onEdit(insertBlock(value, start, end, "```\n代码\n```", 4, 6));
      } else {
        onEdit(wrapSelection(value, start, end, "`", "`", "代码"));
      }
    }
    if (action === "link" || action === "image" || action === "video") {
      setUrl("");
      setExtra("");
      setError("");
      setPanel(panel === action ? null : action);
    }
  }

  function submit() {
    if (!panel) return;
    const parsed = parseHttpUrl(url);
    if (!parsed) return setError("请填写以 http:// 或 https:// 开头的完整地址。");
    if (panel === "video" && !isEmbeddableVideo(url)) {
      return setError("暂不支持这个视频地址。可以用哔哩哔哩、YouTube 链接，或 mp4、webm 视频文件的直链。");
    }
    if (panel === "image" && classifyMedia(url)?.kind !== "image") {
      return setError("这是视频地址，请用“视频”按钮插入。");
    }
    const { start, end } = selection();
    const safe = markdownUrl(parsed.toString());
    if (panel === "link") {
      const label = value.slice(start, end) || "链接文字";
      const snippet = `[${label}](${safe})`;
      onEdit(insertInline(value, start, end, snippet));
    } else if (panel === "image") {
      const alt = (extra || value.slice(start, end)).replace(/[[\]\n]/g, " ").trim();
      const snippet = `![${alt}](${safe})`;
      onEdit(insertBlock(value, start, end, snippet, snippet.length, snippet.length));
    } else {
      const snippet = `![视频](${safe})`;
      onEdit(insertBlock(value, start, end, snippet, snippet.length, snippet.length));
    }
    setPanel(null);
  }

  const buttons: Array<{ action: string; label: string; icon: typeof Bold; active?: boolean }> = [
    { action: "bold", label: "加粗（Ctrl+B）", icon: Bold },
    { action: "italic", label: "斜体（Ctrl+I）", icon: Italic },
    { action: "heading", label: "小标题", icon: Heading2 },
    { action: "quote", label: "引用", icon: Quote },
    { action: "ul", label: "无序列表", icon: List },
    { action: "ol", label: "有序列表", icon: ListOrdered },
    { action: "code", label: "代码", icon: Code },
    { action: "link", label: "链接（Ctrl+K）", icon: LinkIcon, active: panel === "link" },
    { action: "image", label: "图片", icon: ImageIcon, active: panel === "image" },
    { action: "video", label: "视频", icon: Video, active: panel === "video" },
  ];
  const config = panel ? PANELS[panel] : null;

  return (
    <div className="space-y-2">
      <div role="toolbar" aria-label="格式工具栏" className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
        {buttons.map(({ action, label, icon: Icon, active }) => (
          <Button
            key={action}
            type="button"
            variant={active ? "secondary" : "ghost"}
            size="sm"
            disabled={disabled}
            title={label}
            aria-label={label}
            aria-pressed={active}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => run(action)}
            className="h-8 w-8 p-0"
          >
            <Icon className="size-4" />
          </Button>
        ))}
      </div>
      {config ? (
        <div className="space-y-2 rounded-lg border bg-card p-3" role="group" aria-label={config.title}>
          <p className="text-sm font-medium">{config.title}</p>
          <Input
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
              if (event.key === "Escape") setPanel(null);
            }}
            aria-label={config.urlLabel}
            placeholder={config.placeholder}
            autoFocus
            className="h-9 text-base md:text-sm"
          />
          {config.extraLabel ? (
            <Input
              value={extra}
              onChange={(event) => setExtra(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
              aria-label={config.extraLabel}
              placeholder={config.extraPlaceholder}
              maxLength={100}
              className="h-9 text-base md:text-sm"
            />
          ) : null}
          <p className="text-xs text-muted-foreground">{config.hint}</p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={submit}>插入</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPanel(null)}>取消</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
