"use client";

import { Fragment } from "react";
import { splitLinks } from "@/lib/archive";

/** Văn bản có liên kết bấm được (chỉ http/https, mở tab mới). */
export function LinkedText({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((p, i) =>
        p.href ? (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className="break-all text-link underline-offset-2 hover:underline">
            {p.text}
          </a>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  );
}
