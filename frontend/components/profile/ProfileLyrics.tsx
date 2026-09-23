"use client";

import { useEffect, useRef } from "react";

export function ProfileLyrics({ body, trackId }: { body: string; trackId?: string }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    const url = "/dashboard/profile-lyrics.mjs";
    void import(/* webpackIgnore: true */ url)
      .then((module: { mountLyrics: (host: HTMLElement, root: HTMLElement) => () => void }) => {
        const host = ref.current;
        const root = host?.closest<HTMLElement>("[data-profile-layout]");
        if (!disposed && host && root) cleanup = module.mountLyrics(host, root);
      })
      .catch(() => {
        const host = ref.current;
        if (disposed || !host) return;
        const message = document.createElement("p");
        message.setAttribute("role", "status");
        message.textContent = "The lyrics player could not load. Refresh the page to try again.";
        host.replaceChildren(message);
      });
    return () => {
      disposed = true;
      if (cleanup) cleanup();
      else ref.current?.replaceChildren();
    };
  }, [body, trackId]);

  return <section ref={ref} data-lyrics-body={body} data-lyrics-track={trackId} aria-label="Lyrics player" />;
}
