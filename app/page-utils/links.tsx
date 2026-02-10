import type { ReactNode } from "react";

const URL_TOKEN_REGEX = /(https?:\/\/[^\s"'<>)]+|www\.[^\s"'<>)]+)/gi;

function cleanUrlToken(value: string) {
  return value.replace(/[.,!?;:]+$/, "");
}

export function normalizeExternalUrl(value: string): string | null {
  const cleaned = cleanUrlToken(value.trim());
  if (!cleaned) return null;

  const candidate = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export function linkifyText(value: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(URL_TOKEN_REGEX)) {
    const raw = match[0];
    const start = match.index ?? 0;

    if (start > lastIndex) {
      nodes.push(value.slice(lastIndex, start));
    }

    const normalized = normalizeExternalUrl(raw);
    const label = cleanUrlToken(raw);

    if (normalized) {
      nodes.push(
        <a
          key={`${start}-${label}`}
          href={normalized}
          target="_blank"
          rel="noreferrer"
          className="text-sky-300 underline decoration-sky-400 underline-offset-4"
        >
          {label}
        </a>,
      );
    } else {
      nodes.push(label);
    }

    lastIndex = start + raw.length;
  }

  if (lastIndex < value.length) {
    nodes.push(value.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [value];
}

function collectUrls(value: unknown, found: Set<string>) {
  if (typeof value === "string") {
    const matches = value.match(URL_TOKEN_REGEX);
    if (matches) {
      for (const match of matches) {
        const normalized = normalizeExternalUrl(match);
        if (normalized) {
          found.add(normalized);
        }
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectUrls(item, found);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectUrls(nested, found);
    }
  }
}

export function collectContentIdeaLinks(value: unknown) {
  const found = new Set<string>();
  collectUrls(value, found);
  return Array.from(found);
}
