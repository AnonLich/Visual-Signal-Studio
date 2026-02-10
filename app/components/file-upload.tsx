"use client";

import React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface UploadedFile {
    file: File;
    id: string;
    preview?: string;
}

interface FileUploadProps {
    onImageChange?: (image: File | null) => void;
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

function FileIcon({ type }: { type: string }) {
    if (type.startsWith("image/")) {
        return (
            <svg
                className="h-5 w-5 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
                />
            </svg>
        );
    }
    if (type === "application/pdf") {
        return (
            <svg
                className="h-5 w-5 text-destructive"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                />
            </svg>
        );
    }
    return (
        <svg
            className="h-5 w-5 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
            />
        </svg>
    );
}

function UploadIcon() {
    return (
        <svg
            className="mx-auto h-12 w-12 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
            />
        </svg>
    );
}

export function FileUpload({ onImageChange }: FileUploadProps) {
    const [file, setFile] = useState<UploadedFile | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileRef = useRef<UploadedFile | null>(null);

    const processFiles = useCallback((fileList: FileList) => {
        const next = Array.from(fileList).find((candidate) =>
            candidate.type.startsWith("image/"),
        );
        if (!next) {
            return;
        }

        setFile((prev) => {
            if (prev?.preview) {
                URL.revokeObjectURL(prev.preview);
            }
            return {
                file: next,
                id: `${next.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                preview: URL.createObjectURL(next),
            };
        });
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files.length > 0) {
                processFiles(e.dataTransfer.files);
            }
        },
        [processFiles]
    );

    const handleFileInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files && e.target.files.length > 0) {
                processFiles(e.target.files);
                e.target.value = "";
            }
        },
        [processFiles]
    );

    const removeFile = useCallback((id: string) => {
        setFile((prev) => {
            if (!prev || prev.id !== id) {
                return prev;
            }
            if (prev.preview) {
                URL.revokeObjectURL(prev.preview);
            }
            return null;
        });
    }, []);

    useEffect(() => {
        fileRef.current = file;
        onImageChange?.(file?.file ?? null);
    }, [file, onImageChange]);

    useEffect(() => {
        return () => {
            if (fileRef.current?.preview) {
                URL.revokeObjectURL(fileRef.current.preview);
            }
        };
    }, []);

    return (
        <div className="flex flex-col gap-6">
            {/* Drop zone */}
            <Card
                className={cn(
                    "cursor-pointer border-2 border-dashed border-slate-600/80 bg-slate-900/50 transition-all duration-200",
                    isDragging
                        ? "scale-[1.01] border-sky-400/80 bg-sky-900/20"
                        : "hover:border-slate-500 hover:bg-slate-800/60"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-input")?.click()}
                role="button"
                tabIndex={0}
                aria-label="Upload files by clicking or dragging and dropping"
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        document.getElementById("file-input")?.click();
                    }
                }}
            >
                <CardContent className="flex flex-col items-center justify-center px-6 py-16">
                    <UploadIcon />
                    <p className="mt-4 font-mono text-lg font-medium text-slate-100">
                        Drop reference photo
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                        or click to browse from your device
                    </p>
                    <p className="mt-3 text-xs text-slate-500">
                        Supports image formats
                    </p>
                </CardContent>
            </Card>

            <input
                id="file-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileInput}
                aria-hidden="true"
            />

            {/* File list */}
            {file && (
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-foreground">
                            Uploaded file (1)
                        </h2>
                    </div>

                    <div className="flex flex-col gap-3">
                        <FileItem
                            key={file.id}
                            uploadedFile={file}
                            onRemove={removeFile}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function FileItem({
    uploadedFile,
    onRemove,
}: {
    uploadedFile: UploadedFile;
    onRemove: (id: string) => void;
}) {
    return (
        <Card className="overflow-hidden border border-slate-700/70 bg-slate-900/70">
            <div className="flex items-center gap-4 p-4">
                {/* Preview or icon */}
                {uploadedFile.preview ? (
                    <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-slate-800">
                        <img
                            src={uploadedFile.preview || "/placeholder.svg"}
                            alt={`Preview of ${uploadedFile.file.name}`}
                            className="h-full w-full object-cover"
                        />
                    </div>
                ) : (
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-slate-800">
                        <FileIcon type={uploadedFile.file.type} />
                    </div>
                )}

                {/* File info */}
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                        {uploadedFile.file.name}
                    </p>
                    <p className="text-xs text-slate-400">
                        {formatFileSize(uploadedFile.file.size)}
                    </p>
                </div>

                {/* Remove button */}
                <button
                    onClick={() => onRemove(uploadedFile.id)}
                    className="flex-shrink-0 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-rose-950/20 hover:text-rose-300"
                    aria-label={`Remove ${uploadedFile.file.name}`}
                >
                    <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18 18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>
        </Card>
    );
}
