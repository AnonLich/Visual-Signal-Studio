"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { FileUpload } from "./components/file-upload";
import { PromptSearch } from "./components/prompt-search";
import {
  analyzeImagesStream,
  refineStrategyStream,
  type TrendStrategy,
  type TrendStreamEvent,
} from "@/lib/client/api";
import { fileToBase64 } from "@/lib/client/images";

const URL_TOKEN_REGEX = /(https?:\/\/[^\s"'<>)]+|www\.[^\s"'<>)]+)/gi;

function cleanUrlToken(value: string) {
  return value.replace(/[.,!?;:]+$/, "");
}

function normalizeExternalUrl(value: string): string | null {
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

function linkifyText(value: string): ReactNode[] {
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
          className="text-cyan-200 underline decoration-cyan-300 underline-offset-4"
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
    for (const item of value) collectUrls(item, found);
    return;
  }

  if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectUrls(nested, found);
    }
  }
}

function collectContentIdeaLinks(value: unknown) {
  const found = new Set<string>();
  collectUrls(value, found);
  return Array.from(found);
}

export default function Page() {
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [events, setEvents] = useState<TrendStreamEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentStrategy, setCurrentStrategy] = useState<TrendStrategy | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  type ChatMessage = {
    id: string;
    tone: "info" | "step" | "success" | "error";
    title: string;
    body: string;
    tools?: string[];
  };

  const chatMessages: ChatMessage[] = useMemo(() => {
    return events.map((event, idx) => {
      const base = { id: `${event.type}-${idx}` };
      if (event.type === "status") {
        return { ...base, tone: "info", title: "Status", body: event.message };
      }
      if (event.type === "step") {
        const phase = event.phase ? ` (${event.phase})` : "";
        const tools =
          event.toolCalls?.map((t) => t.toolName).filter(Boolean) ?? [];
        const body =
          event.text ||
          event.reasoningText ||
          (tools.length ? `Calling ${tools.join(", ")}` : "Thinking...");
        return {
          ...base,
          tone: "step",
          title: `Step ${event.stepNumber}${phase}`,
          body,
          tools,
        };
      }
      if (event.type === "image-complete") {
        return {
          ...base,
          tone: "success",
          title: "Image processed",
          body: "Strategy generated for this image.",
        };
      }
      if (event.type === "refine-complete") {
        return {
          ...base,
          tone: "success",
          title: "Refinement complete",
          body: "Updated strategy ready.",
        };
      }
      if (event.type === "complete") {
        return {
          ...base,
          tone: "success",
          title: "Analysis complete",
          body: `Items: ${event.count}`,
        };
      }
      if (event.type === "error") {
        return {
          ...base,
          tone: "error",
          title: "Error",
          body: event.message,
        };
      }
      return { ...base, tone: "info", title: event.type, body: "" };
    });
  }, [events]);

  const handleImagesChange = useCallback((images: File[]) => {
    setSelectedImages(images);
  }, []);

  const handleAnalyze = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setEvents([]);
    setCurrentStrategy(null);
    setCurrentImageUrl(null);
    try {
      const images = await Promise.all(
        selectedImages.map(async (file) => ({
          data: await fileToBase64(file),
          mediaType: file.type || "image/jpeg",
        })),
      );

      await analyzeImagesStream(
        { prompt: "Analyze the uploaded image(s).", images },
        (event) => {
          setEvents((prev) => [...prev, event]);
          if (event.type === "image-complete") {
            setCurrentStrategy(event.strategy as TrendStrategy);
            setCurrentImageUrl(event.imageUrl);
          }
          if (event.type === "complete" && event.items[0]) {
            setCurrentStrategy(event.items[0].strategy as TrendStrategy);
            setCurrentImageUrl(event.items[0].imageUrl);
          }
          if (event.type === "error") {
            setError(event.message);
          }
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [selectedImages]);

  const handleRefine = useCallback(async () => {
    if (!feedback.trim()) {
      setError("Please enter feedback before refining.");
      return;
    }
    if (!currentStrategy) {
      setError("No strategy available yet. Run an analysis first.");
      return;
    }
    setIsRefining(true);
    setError(null);
    setEvents((prev) => [
      ...prev,
      {
        type: "status",
        imageIndex: 1,
        message: `Refinement started with feedback: ${feedback.trim()}`,
      },
    ]);
    try {
      await refineStrategyStream(
        {
          feedback: feedback.trim(),
          currentStrategy,
          imageUrl: currentImageUrl ?? undefined,
        },
        (event) => {
          setEvents((prev) => [...prev, event]);
          if (event.type === "refine-complete") {
            setCurrentStrategy(event.strategy as TrendStrategy);
          }
          if (event.type === "error") {
            setError(event.message);
          }
        },
      );
      setFeedback("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown refinement error");
    } finally {
      setIsRefining(false);
    }
  }, [currentImageUrl, currentStrategy, feedback]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-8 lg:px-10">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_80px_-30px_rgba(0,0,0,0.8)] backdrop-blur">
          <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.3em] text-teal-300/80">Trend Orchestrator</p>
              <h1 className="text-3xl font-semibold text-white">Vision-to-Trend Lab</h1>
              <p className="text-sm text-slate-300">Upload a vibe, watch the agent think, then steer it with your own notes.</p>
            </div>
            <div className="flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-teal-500/80 to-cyan-400/80 px-4 text-sm font-medium text-slate-900 shadow-lg shadow-teal-500/30">
              <span className="h-2 w-2 rounded-full bg-slate-900" />
              Live multi-step reasoning
            </div>
          </header>

          <div className="grid gap-6 lg:grid-cols-[1.6fr,1fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-white">Upload & Run</div>
                  {selectedImages.length > 0 && (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-teal-200">
                      {selectedImages.length} ready
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <FileUpload onImagesChange={handleImagesChange} />
                </div>
                {selectedImages.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-300">
                      Ready to send {selectedImages.length} image{selectedImages.length === 1 ? "" : "s"} to the agent.
                    </p>
                    <button
                      type="button"
                      onClick={handleAnalyze}
                      disabled={isLoading}
                      className="inline-flex items-center justify-center rounded-full bg-teal-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:shadow-lg hover:shadow-teal-400/30 disabled:opacity-50"
                    >
                      {isLoading ? "Analyzing..." : "Analyze"}
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner">
                <PromptSearch />
              </div>

              {error && (
                <div className="rounded-2xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>
              )}

              {currentStrategy && (
                <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-4 text-sm text-slate-100 shadow-inner space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-teal-200">Latest Strategy</div>
                      <div className="text-lg font-semibold text-white">Creative Direction</div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-teal-200">Strategic Brief</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-100">{currentStrategy.strategicBrief}</p>
                  </div>
                  {currentStrategy.reasoning && (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs text-teal-200">Reasoning</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-200">{currentStrategy.reasoning}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.2em] text-teal-200">Content Ideas</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {currentStrategy.contentIdeas.map((idea, idx) => (
                        (() => {
                          const links = collectContentIdeaLinks(idea);
                          return (
                        <div
                          key={idx}
                          className="rounded-xl border border-white/10 bg-slate-900/60 p-3 shadow-sm shadow-black/30 space-y-2"
                        >
                          <p className="text-sm font-semibold text-white">{idea.title || `Idea ${idx + 1}`}</p>
                          {idea.tiktok_script && (
                            <div className="rounded-lg border border-white/5 bg-white/5 p-2 text-xs text-slate-100 space-y-1">
                              <p className="font-semibold text-teal-200">TikTok Script</p>
                              {idea.tiktok_script.hook && (
                                <p><span className="text-slate-300">Hook:</span> {idea.tiktok_script.hook}</p>
                              )}
                              {idea.tiktok_script.visual_direction && (
                                <p><span className="text-slate-300">Visual:</span> {idea.tiktok_script.visual_direction}</p>
                              )}
                              {idea.tiktok_script.audio_spec && (
                                <p><span className="text-slate-300">Audio:</span> {idea.tiktok_script.audio_spec}</p>
                              )}
                            </div>
                          )}
                          {idea.concept && (
                            <p className="text-xs text-slate-200"><span className="text-slate-400">Concept:</span> {idea.concept}</p>
                          )}
                          {idea.source_evidence && (
                            <p className="text-xs text-teal-200">
                              Source:{" "}
                              <span className="text-slate-100">{linkifyText(idea.source_evidence)}</span>
                            </p>
                          )}
                          {idea.cultural_context && (
                            <p className="text-xs text-slate-300">{linkifyText(idea.cultural_context)}</p>
                          )}
                          {idea.sourceUrl && normalizeExternalUrl(idea.sourceUrl) && (
                            <a
                              className="text-xs text-cyan-200 underline decoration-cyan-300 underline-offset-4"
                              href={normalizeExternalUrl(idea.sourceUrl) ?? undefined}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Source link
                            </a>
                          )}
                          {links.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-teal-200">Links</p>
                              <div className="space-y-1">
                                {links.map((url) => (
                                  <a
                                    key={url}
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block truncate text-xs text-cyan-200 underline decoration-cyan-300 underline-offset-4"
                                  >
                                    {url}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                          );
                        })()
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {currentStrategy && (
                <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">Refine With Feedback</h2>
                    <span className="text-[11px] uppercase tracking-[0.2em] text-teal-200">Interactive</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300">Tell the agent if you like it or not and how to niche it further.</p>
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Example: Push this toward moody brutalist interiors for Gen Z design students. Keep handheld, harsh flash."
                      className="min-h-24 w-full rounded-xl border border-white/10 bg-slate-900/60 p-3 text-sm text-white outline-none ring-1 ring-transparent transition focus:border-teal-300/60 focus:ring-teal-300/30"
                    />
                    <button
                      type="button"
                      onClick={handleRefine}
                      disabled={isRefining || !feedback.trim()}
                      className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-teal-400 to-cyan-300 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:shadow-lg hover:shadow-teal-400/30 disabled:opacity-50"
                    >
                      {isRefining ? "Refining..." : "Send Feedback"}
                    </button>
                  </div>
                </section>
              )}
            </div>

            <div className="space-y-4">
              {events.length > 0 && (
                <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-inner">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">Live Agent Flow</h2>
                    <span className="text-[11px] uppercase tracking-[0.2em] text-teal-200">Streaming</span>
                  </div>
                  <div className="mt-3 space-y-3 max-h-[520px] overflow-auto">
                    {chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="rounded-xl border border-white/5 bg-white/5 p-3 text-xs text-slate-100 shadow-sm shadow-black/30"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                msg.tone === "error"
                                  ? "bg-red-400"
                                  : msg.tone === "success"
                                  ? "bg-teal-300"
                                  : "bg-cyan-300"
                              }`}
                            />
                            <span className="text-[11px] font-semibold text-teal-100">
                              {msg.title}
                            </span>
                          </div>
                        </div>
                        {msg.body && (
                          <p className="mt-2 text-[12px] leading-relaxed text-slate-100">
                            {msg.body}
                          </p>
                        )}
                        {Array.isArray(msg.tools) && msg.tools.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {msg.tools.map((tool: string) => (
                              <span
                                key={tool}
                                className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[11px] text-cyan-100"
                              >
                                {tool}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
