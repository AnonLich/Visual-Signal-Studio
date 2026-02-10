"use client";

import { useCallback, useMemo, useState } from "react";
import {
  analyzeImagesStream,
  refineStrategyStream,
  type TrendStrategy,
  type TrendStreamEvent,
} from "@/lib/client/api";
import { fileToBase64 } from "@/lib/client/images";
import { AnalysisPanel } from "@/app/components/trend-lab/analysis-panel";
import { StrategyPanel } from "@/app/components/trend-lab/strategy-panel";
import { LabLog } from "@/app/components/trend-lab/lab-log";
import { toChatMessages } from "@/app/page-utils/chat-messages";

export default function Page() {
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [events, setEvents] = useState<TrendStreamEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentStrategy, setCurrentStrategy] = useState<TrendStrategy | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  const isAgentWorking = isLoading || isRefining;
  const chatMessages = useMemo(() => toChatMessages(events), [events]);

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
    <main className="relative min-h-screen overflow-hidden bg-[#0f1115] text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(148,163,184,0.08),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(56,189,248,0.06),transparent_35%)]" />
      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-8 lg:px-10">
        <div className="rounded-3xl border border-slate-700/60 bg-slate-900/60 p-6 shadow-[0_24px_80px_-34px_rgba(2,6,23,0.9)] backdrop-blur-md sm:p-8">
          <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Trend Lab</p>
              <h1 className="font-mono text-3xl font-semibold text-slate-100">Visual Signal Studio</h1>
              <p className="text-sm text-slate-400">
                Upload reference images, inspect source-backed ideas, then refine direction with feedback.
              </p>
            </div>
            <div className="flex h-11 items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 text-sm font-medium text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              Session active
            </div>
          </header>

          <div className="grid gap-6 lg:grid-cols-[1.6fr,1fr]">
            <div className="space-y-4">
              <AnalysisPanel
                selectedImagesCount={selectedImages.length}
                isLoading={isLoading}
                onImagesChange={handleImagesChange}
                onAnalyze={handleAnalyze}
              />

              {error && (
                <div className="rounded-2xl border border-rose-500/50 bg-rose-950/30 p-4 text-sm text-rose-100">
                  {error}
                </div>
              )}

              {currentStrategy && (
                <StrategyPanel
                  strategy={currentStrategy}
                  feedback={feedback}
                  isRefining={isRefining}
                  onFeedbackChange={setFeedback}
                  onRefine={handleRefine}
                />
              )}
            </div>

            <div className="space-y-4">
              <LabLog messages={chatMessages} isAgentWorking={isAgentWorking} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
