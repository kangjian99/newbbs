"use client";

import { useEffect } from "react";

export function ThreadVisit({ id }: { id: string }) {
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/threads/${id}/visit`, { method: "POST", signal: controller.signal }).catch(() => undefined);
    return () => controller.abort();
  }, [id]);
  return null;
}
