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
import { Info } from "lucide-react";

export default function Page() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [events, setEvents] = useState<TrendStreamEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentStrategy, setCurrentStrategy] = useState<TrendStrategy | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  const isAgentWorking = isLoading || isRefining;
  const chatMessages = useMemo(() => toChatMessages(events), [events]);

  const handleImageChange = useCallback((image: File | null) => {
    setSelectedImage(image);
  }, []);

  const handleAnalyze = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setEvents([]);
    setCurrentStrategy(null);
    setCurrentImageUrl(null);

    try {
      if (!selectedImage) {
        setError("Please upload one image before analyzing.");
        return;
      }

      const image = {
        data: await fileToBase64(selectedImage),
        mediaType: selectedImage.type || "image/jpeg",
      };

      await analyzeImagesStream(
        { prompt: "Analyze the uploaded image.", image },
        (event) => {
          setEvents((prev) => [...prev, event]);

          if (event.type === "image-complete") {
            setCurrentStrategy(event.strategy as TrendStrategy);
            setCurrentImageUrl(event.imageUrl);
          }

          if (event.type === "complete") {
            setCurrentStrategy(event.strategy as TrendStrategy);
            setCurrentImageUrl(event.imageUrl);
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
  }, [selectedImage]);

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
              <div className="flex items-start gap-2">
                <p className="text-sm text-slate-400">
                  Your only marketing studio, powered by AI. Upload an image and see the magic happen in real-time
                </p>
                <div className="group relative mt-0.5">
                  <button
                    type="button"
                    aria-label="More information about this project"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-600/80 bg-slate-800/70 text-slate-300 transition hover:border-sky-400/70 hover:text-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                  <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-72 -translate-x-1/2 rounded-xl border border-slate-700/80 bg-slate-950/95 p-3 text-xs leading-relaxed text-slate-200 opacity-0 shadow-[0_18px_45px_-20px_rgba(2,6,23,0.95)] transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100 sm:left-full sm:top-1/2 sm:mt-0 sm:ml-3 sm:w-80 sm:-translate-y-1/2 sm:translate-x-0">
                    I built this Trend-Engine to prove that AI can do more than just describe, it can synthesize. By deconstructing visual DNA and force-multiplying it with real-time cultural signals, I’ve created a tool that turns a simple upload into a production-ready creative strategy.
                  </div>
                </div>
              </div>
            </div>
            <div className="flex h-11 items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 text-sm font-medium text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              Session active
            </div>
          </header>

          <div className="grid gap-6 lg:grid-cols-[1.6fr,1fr]">
            <div className="space-y-4">
              <AnalysisPanel
                hasSelectedImage={Boolean(selectedImage)}
                isLoading={isLoading}
                onImageChange={handleImageChange}
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
