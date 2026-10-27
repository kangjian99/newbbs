"use client";

import { useState } from "react";
import { useActionState } from "react";
import { MarkdownView } from "@/components/markdown-view";
import { NativeSelect } from "@/components/forum-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/types";

export function Composer({
  action,
  submitLabel,
  placeholder = "把想说的话写清楚。支持 Markdown。",
  initialContent = "",
  initialTitle = "",
  showTitle = false,
  boards,
  initialBoardId,
  parentId,
  threadId,
  postId,
  compact = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  placeholder?: string;
  initialContent?: string;
  initialTitle?: string;
  showTitle?: boolean;
  boards?: Array<{ id: string; name: string }>;
  initialBoardId?: string;
  parentId?: string;
  threadId?: string;
  postId?: string;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [content, setContent] = useState(initialContent);
  const [preview, setPreview] = useState(false);

  return (
    <form action={formAction} className="space-y-3">
      {threadId ? <input type="hidden" name="threadId" value={threadId} /> : null}
      {postId ? <input type="hidden" name="postId" value={postId} /> : null}
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      {boards ? (
        <div className="space-y-1.5">
          <Label htmlFor="boardId">版块</Label>
          <NativeSelect id="boardId" name="boardId" defaultValue={initialBoardId ?? boards[0]?.id} required>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </NativeSelect>
          {state?.fieldErrors?.boardId ? <p className="text-sm text-destructive">{state.fieldErrors.boardId}</p> : null}
        </div>
      ) : null}
      {showTitle ? (
        <div className="space-y-1.5">
          <Label htmlFor={postId ? `title-${postId}` : "title"}>标题（选填）</Label>
          <Input id={postId ? `title-${postId}` : "title"} name="title" minLength={2} maxLength={60} defaultValue={initialTitle} className="h-10" placeholder={postId ? undefined : "不填则取正文第一行"} />
          {state?.fieldErrors?.title ? <p className="text-sm text-destructive">{state.fieldErrors.title}</p> : null}
        </div>
      ) : null}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={postId ? `content-${postId}` : "content"}>{showTitle ? "正文" : "回复"}</Label>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPreview((value) => !value)}>
            {preview ? "返回编辑" : "预览"}
          </Button>
        </div>
        {preview ? (
          <div className="min-h-28 rounded-lg border bg-card px-3 py-2">
            {content.trim() ? <MarkdownView content={content} /> : <p className="text-sm text-muted-foreground">还没有内容</p>}
          </div>
        ) : (
          <Textarea
            id={postId ? `content-${postId}` : "content"}
            name="content"
            required
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={placeholder}
            className={compact ? "min-h-28 text-base md:text-base" : "min-h-40 text-base md:text-base"}
          />
        )}
        {state?.fieldErrors?.content ? <p className="text-sm text-destructive">{state.fieldErrors.content}</p> : null}
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Markdown 说明</summary>
        <p className="mt-1">支持标题、列表、引用、链接、行内代码和代码块。原始 HTML 会被去掉。</p>
      </details>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending} className="h-10 px-4">
        {pending ? "提交中…" : submitLabel}
      </Button>
    </form>
  );
}
