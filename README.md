# Trend-Engine: Multimodal Agentic Research

A pipeline designed to bridge the gap between static visual assets and viral cultural trends.
Instead of generic LLM descriptions, this engine performs a **Creative Collision** between vision analysis and real-time social signals.

## 1. High-Level Vision (The "Why")

Most AI workflows describe an image, then stop.
This project is built to do something more useful for creative teams: convert a static reference into a trend-aware, production-ready content direction.

The goal is not "nice AI output."  
The goal is **strategic relevance + cultural timing + creative edge**.

## 2. Architecture & Logic (The "How")

The pipeline runs in three core phases:

1. **Visual DNA Extraction**
   Uses GPT-4o Vision to deconstruct an image into structured creative parameters:
   archetypes, aesthetic style, lighting/mood, palette, visual markers, and market positioning.

2. **Agentic Search**
   Uses Exa AI to pull fresh, niche trend signals from culture-first sources
   (for example Substacks and TikTok-adjacent signals), instead of generic SEO content.

3. **Semantic Re-ranking**
   Uses `text-embedding-3-small` and cosine similarity to match image DNA against research outputs.
   This forces the final strategy to stay tightly aligned with the original visual intent.

## 3. The "Creative Collision" Framework

This system is intentionally designed to avoid default "LLM politeness."

- It uses **creative constraints** to force specificity in output shape.
- It frames the model behavior as a **Creative Director** role, not a generic AI assistant.
- It combines conflicting inputs (visual identity + emerging trend signals) to generate sharper, less predictable content ideas.

Result: strategy outputs that are more directional, culturally grounded, and creatively distinct.

## 4. Tech Stack

- **Framework:** Next.js (App Router)
- **AI Orchestration:** Vercel AI SDK
- **Models:** GPT-4o (Vision/Reasoning), `text-embedding-3-small`
- **Search:** Exa AI

## 5. Getting Started

1. Clone the repo.
2. Create `.env.local` with:

```bash
OPENAI_API_KEY=...
EXA_API_KEY=...
```

3. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Note

Current server code reads `EXA_SEARCH_API_KEY`.
If you use `EXA_API_KEY` in `.env.local`, also add:

```bash
EXA_SEARCH_API_KEY=$EXA_API_KEY
```
