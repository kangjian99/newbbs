"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Composer } from "@/components/composer";
import { Floor, TimeText, UserAvatar } from "@/components/forum-bits";
import { MarkdownView } from "@/components/markdown-view";
import { deletePostAction, editPostAction, hidePostAction, replyAction, reportAction, restorePostAction } from "@/server/actions/forum";
import { REPORT_REASONS, ROLE_LABEL } from "@/lib/constants";
import type { PostDTO } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/forum-bits";
import { Textarea } from "@/components/ui/textarea";
type Node = PostDTO & { children: Node[] };

function buildTree(posts: PostDTO[]) {
  const nodes = new Map<string, Node>();
  for (const post of posts) nodes.set(post.id, { ...post, children: [] });
  const roots: Node[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function countDescendants(node: Node): number {
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
}

function ReportDialog({ postId }: { postId: string }) {
  const [state, action, pending] = useActionState(reportAction, null);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">举报</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>举报这条发言</DialogTitle>
          <DialogDescription>选择原因即可。补充说明是可选的，版主会在审核队列里看到。</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-3">
          <input type="hidden" name="targetType" value="post" />
          <input type="hidden" name="targetId" value={postId} />
          <div className="space-y-1.5">
            <Label htmlFor={`reason-${postId}`}>原因</Label>
            <NativeSelect id={`reason-${postId}`} name="reason" defaultValue="spam">
              {REPORT_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>{reason.label}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`detail-${postId}`}>补充说明</Label>
            <Textarea id={`detail-${postId}`} name="detail" maxLength={500} className="min-h-24" />
          </div>
          {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state?.ok ? <p className="text-sm text-primary">{state.ok}</p> : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">取消</Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>{pending ? "提交中…" : "提交举报"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function deleteNotice(post: PostDTO, isOp: boolean) {
  if (!isOp) {
    return post.staffDelete
      ? `你正在删除「${post.nickname}」的这条发言。删除后普通会员会看到“该发言已删除”，管理人员可以恢复。`
      : "删除后，其他会员会看到「该发言已删除」。";
  }
  if (!post.staffDelete) return "目前还没有人回复，删除后主题会从列表中消失。已经有人回复的主题不能由作者删除。";
  const replies = post.threadReplyCount > 0 ? `其中 ${post.threadReplyCount} 条回复也会一起从普通会员面前消失。` : "";
  return `你正在删除「${post.nickname}」的整个主题。${replies}管理人员可以在主题页恢复。`;
}

function DeleteDialog({ post, isOp }: { post: PostDTO; isOp: boolean }) {
  const [state, action, pending] = useActionState(deletePostAction, null);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">删除</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {post.staffDelete ? "管理操作：" : ""}
            {isOp ? "删除整个主题？" : "删除这条发言？"}
          </DialogTitle>
          <DialogDescription>{deleteNotice(post, isOp)}</DialogDescription>
        </DialogHeader>
        <form action={action}>
          <input type="hidden" name="postId" value={post.id} />
          {state?.error ? <p className="mb-3 text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">取消</Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>{pending ? "删除中…" : "确认删除"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HideDialog({ post }: { post: PostDTO }) {
  const [state, action, pending] = useActionState(hidePostAction, null);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">{post.hidden ? "取消隐藏" : "隐藏"}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{post.hidden ? "重新显示这条发言？" : "隐藏这条发言？"}</DialogTitle>
          <DialogDescription>隐藏后，普通会员只能看到提示，作者和管理人员仍能看到原文。</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-3">
          <input type="hidden" name="postId" value={post.id} />
          <input type="hidden" name="hidden" value={post.hidden ? "0" : "1"} />
          {post.hidden ? null : (
            <div className="space-y-1.5">
              <Label htmlFor={`hide-${post.id}`}>原因</Label>
              <Textarea id={`hide-${post.id}`} name="reason" maxLength={80} className="min-h-20" placeholder="例如：广告引流" />
            </div>
          )}
          {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">取消</Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>{pending ? "处理中…" : "确认"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PostBody({ post }: { post: PostDTO }) {
  if (post.deleted && !post.canViewBody) return <p className="text-muted-foreground">该发言已删除</p>;
  if (post.hidden && !post.canViewBody) {
    return <p className="text-muted-foreground">此发言已被版主隐藏{post.hiddenReason ? `：${post.hiddenReason}` : ""}</p>;
  }
  return (
    <div className="space-y-2">
      {post.deleted ? <p className="text-sm text-destructive">已删除，仅管理人员可见</p> : null}
      {post.hidden ? (
        <p className="text-sm text-amber-800">已隐藏{post.hiddenReason ? `：${post.hiddenReason}` : ""}。作者和管理人员仍能看到原文。</p>
      ) : null}
      <MarkdownView content={post.content} />
    </div>
  );
}

function NodeView({
  node,
  depth,
  threadId,
  threadTitle,
  replyingTo,
  setReplyingTo,
  editingId,
  setEditingId,
  collapsed,
  toggle,
  byId,
}: {
  node: Node;
  depth: number;
  threadId: string;
  threadTitle: string;
  replyingTo: string | null;
  setReplyingTo: (id: string | null) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  collapsed: (id: string, depth: number, count: number) => boolean;
  toggle: (id: string, depth: number, count: number) => void;
  byId: Map<string, PostDTO>;
}) {
  const parent = node.parentId ? byId.get(node.parentId) : undefined;
  const childCount = node.children.length;
  const isCollapsed = collapsed(node.id, depth, childCount);
  const nest = depth === 0 || depth >= 5;
  return (
    <article id={`post-${node.id}`} className="scroll-mt-24">
      <div className="flex gap-3">
        <UserAvatar name={node.nickname} hue={node.avatarHue} />
        <div className="min-w-0 flex-1">
          <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
            <Link href={`/members/${node.username}`} className="font-medium hover:text-primary">{node.nickname}</Link>
            {node.role !== "user" ? <Badge variant="secondary">{ROLE_LABEL[node.role]}</Badge> : null}
            <TimeText value={node.createdAt} />
            <Floor value={node.floor} />
            {node.editedAt ? <span className="text-muted-foreground">已编辑</span> : null}
          </header>
          {depth > 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              回复 {node.parentNickname ?? parent?.nickname ?? "更早的发言"}
            </p>
          ) : null}
          <div className="mt-2">
            {editingId === node.id ? (
              <Composer
                action={editPostAction}
                submitLabel="保存"
                showTitle={node.isOp}
                initialTitle={threadTitle}
                initialContent={node.content}
                threadId={threadId}
                postId={node.id}
                compact
              />
            ) : (
              <PostBody post={node} />
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {node.canReply ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setReplyingTo(replyingTo === node.id ? null : node.id)}>
                {replyingTo === node.id ? "取消回复" : "回复"}
              </Button>
            ) : null}
            {node.canEdit ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(editingId === node.id ? null : node.id)}>
                {editingId === node.id ? "取消编辑" : "编辑"}
              </Button>
            ) : null}
            {node.canDelete ? <DeleteDialog post={node} isOp={node.isOp} /> : null}
            {node.canRestore ? (
              <form action={restorePostAction}>
                <input type="hidden" name="postId" value={node.id} />
                <Button type="submit" variant="ghost" size="sm">恢复</Button>
              </form>
            ) : null}
            {node.canHide ? <HideDialog post={node} /> : null}
            {node.canReport ? <ReportDialog postId={node.id} /> : null}
            {childCount > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => toggle(node.id, depth, childCount)} aria-expanded={!isCollapsed}>
                {isCollapsed ? `展开 ${countDescendants(node)} 条回复` : "收起回复"}
              </Button>
            ) : null}
          </div>
          {replyingTo === node.id ? (
            <div className="mt-3 rounded-lg border bg-card/60 p-3">
              <p className="mb-2 text-sm text-muted-foreground">回复 {node.nickname}</p>
              <Composer action={replyAction} submitLabel="发表回复" threadId={threadId} parentId={node.id} compact placeholder={`回复 ${node.nickname}`} />
            </div>
          ) : null}
        </div>
      </div>
      {childCount > 0 && !isCollapsed ? (
        <div className={nest && depth >= 5 ? "mt-4 space-y-4" : "mt-4 space-y-4 border-l border-primary/30 pl-3 sm:pl-4"}>
          {depth >= 5 ? <p className="text-xs text-muted-foreground">继续嵌套</p> : null}
          {node.children.map((child) => (
            <NodeView
              key={child.id}
              node={child}
              depth={depth + 1}
              threadId={threadId}
              threadTitle={threadTitle}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              editingId={editingId}
              setEditingId={setEditingId}
              collapsed={collapsed}
              toggle={toggle}
              byId={byId}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function ThreadDiscussion({ threadId, threadTitle, posts }: { threadId: string; threadTitle: string; posts: PostDTO[] }) {
  const tree = useMemo(() => buildTree(posts), [posts]);
  const byId = useMemo(() => new Map(posts.map((post) => [post.id, post])), [posts]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const id = window.location.hash.replace(/^#post-/, "");
    if (!id || !byId.has(id)) return;
    const opened: Record<string, boolean> = {};
    let current: string | null = id;
    while (current) {
      const parentId: string | null = byId.get(current)?.parentId ?? null;
      if (parentId) opened[parentId] = false;
      current = parentId;
    }
    setOverrides((prev) => ({ ...prev, ...opened }));
    const timer = window.setTimeout(() => {
      document.getElementById(`post-${id}`)?.scrollIntoView({ block: "center" });
    }, 40);
    return () => window.clearTimeout(timer);
  }, [byId]);

  function collapsed(id: string, depth: number, count: number) {
    if (count === 0) return false;
    if (id in overrides) return overrides[id] ?? false;
    if (expandAll) return false;
    return depth >= 2;
  }

  function toggle(id: string, depth: number, count: number) {
    setOverrides((prev) => ({ ...prev, [id]: !collapsed(id, depth, count) }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => { setExpandAll(true); setOverrides({}); }}>
          展开全部
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => { setExpandAll(false); setOverrides({}); }}>
          收起深层回复
        </Button>
      </div>
      {tree.map((node) => (
        <NodeView
          key={node.id}
          node={node}
          depth={0}
          threadId={threadId}
          threadTitle={threadTitle}
          replyingTo={replyingTo}
          setReplyingTo={setReplyingTo}
          editingId={editingId}
          setEditingId={setEditingId}
          collapsed={collapsed}
          toggle={toggle}
          byId={byId}
        />
      ))}
    </div>
  );
}
