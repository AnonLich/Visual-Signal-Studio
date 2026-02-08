"use client";

import { useCallback, useState } from "react";
import { FileUpload } from "./components/file-upload";
import { PromptSearch } from "./components/prompt-search";

type SearchMatch = {
  id: number;
  imageUrl: string | null;
  distance: number;
};

type SearchResponse = {
  ok: boolean;
  prompt: string;
  matches: SearchMatch[];
};

type SearchDisplayMatch = SearchMatch & {
  signedImageUrl: string | null;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Failed to read file"));
        return;
      }
      const [, base64] = reader.result.split(",");
      resolve(base64 ?? "");
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export default function Page() {
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchPrompt, setSearchPrompt] = useState("");
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [searchMatches, setSearchMatches] = useState<SearchDisplayMatch[]>([]);

  const handleImagesChange = useCallback((images: File[]) => {
    setSelectedImages(images);
  }, []);

  const handleAnalyze = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const images = await Promise.all(
        selectedImages.map(async (file) => ({
          data: await fileToBase64(file),
          mediaType: file.type || "image/jpeg",
        }))
      );

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Analyze the uploaded image(s). Return a concise summary.",
          images,
        }),
      });

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [selectedImages]);

  const handlePromptSearch = useCallback(async () => {
    const prompt = searchPrompt.trim();
    if (!prompt) return;

    setIsSearchLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/prompt-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const data = (await res.json()) as SearchResponse;

      const signedMatches = await Promise.all(
        data.matches.map(async (match) => {
          if (!match.imageUrl) {
            return { ...match, signedImageUrl: null };
          }

          const presignRes = await fetch("/api/s3/presign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: match.imageUrl }),
          });

          if (!presignRes.ok) {
            throw new Error(`View URL presign failed with status ${presignRes.status}`);
          }

          const presignData = (await presignRes.json()) as { viewUrl: string };
          return { ...match, signedImageUrl: presignData.viewUrl };
        })
      );

      setSearchMatches(signedMatches);
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSearchMatches([]);
    } finally {
      setIsSearchLoading(false);
    }
  }, [searchPrompt]);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <svg
              className="h-7 w-7 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance">
            AI Analyzer
          </h1>
          <p className="mt-2 text-base text-muted-foreground leading-relaxed">
            Upload your files to get started with AI-powered analysis
          </p>
        </header>

        <FileUpload onImagesChange={handleImagesChange} />
        <PromptSearch
          value={searchPrompt}
          onChange={setSearchPrompt}
          onSubmit={handlePromptSearch}
          isLoading={isSearchLoading}
        />

        {selectedImages.length > 0 && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Ready to send {selectedImages.length} image{selectedImages.length === 1 ? "" : "s"} to the server component.
            </p>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isLoading}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {isLoading ? "Analyzing..." : "Analyze"}
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        )}

        {result && (
          <pre className="mt-4 overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}

        {searchMatches.length > 0 && (
          <section className="mt-6 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Search Matches</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {searchMatches.map((match) => (
                <article
                  key={match.id}
                  className="overflow-hidden rounded-md border border-border bg-card"
                >
                  {match.signedImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={match.signedImageUrl}
                      alt={`Match ${match.id}`}
                      className="h-40 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-40 items-center justify-center bg-muted text-xs text-muted-foreground">
                      No image URL
                    </div>
                  )}
                  <div className="space-y-1 p-3 text-xs">
                    <p className="text-muted-foreground">ID: {match.id}</p>
                    <p className="text-muted-foreground">
                      Distance: {Number(match.distance).toFixed(4)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
