"use client";

import { useEffect, useState } from "react";

// Hook to load KaTeX CSS and JS dynamically from cdn
export function useKaTeX() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).katex) {
      setLoaded(true);
      return;
    }

    // Check if stylesheet is already loaded to avoid duplication
    const existingLink = document.querySelector('link[href*="katex"]');
    if (!existingLink) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css";
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    }

    // Check if script is already loaded to avoid duplication
    const existingScript = document.querySelector('script[src*="katex"]');
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if ((window as any).katex) {
          clearInterval(checkInterval);
          setLoaded(true);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js";
    script.crossOrigin = "anonymous";
    script.async = true;
    script.onload = () => {
      setLoaded(true);
    };
    document.head.appendChild(script);
  }, []);

  return loaded;
}

// Render Markdown and KaTeX LaTeX formulas to HTML
export function renderMathAndMarkdown(text: string | undefined): { __html: string } {
  if (!text) return { __html: "" };
  
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold **text**
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Italic *text*
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Get KaTeX library from window if available
  const katex = typeof window !== "undefined" ? (window as any).katex : null;

  if (katex) {
    // Render double dollar formulas $$...$$ (block math)
    html = html.replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, (_, math) => {
      try {
        return `<div class="katex-display-wrapper my-3 text-center overflow-x-auto select-all p-1.5 hover:bg-slate-50/50 rounded-lg transition-colors">${katex.renderToString(math.trim(), { displayMode: true, throwOnError: false })}</div>`;
      } catch (err) {
        return `<div class="font-mono bg-paper border border-line p-2 text-rose-600 rounded select-text">${math}</div>`;
      }
    });

    // Render single dollar formulas $...$ (inline math)
    html = html.replace(/\$([^$]+)\$/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
      } catch (err) {
        return `<span class="font-mono bg-paper text-rose-600 px-1 select-text">${math}</span>`;
      }
    });
  } else {
    // Fallback if KaTeX is not loaded yet (standard monospace representation)
    html = html.replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, "<div class='font-mono bg-paper border border-line/60 px-3 py-2 rounded text-civic text-center my-2 font-semibold overflow-x-auto select-all'>$1</div>");
    html = html.replace(/\$([^$]+)\$/g, "<span class='font-mono bg-paper border border-line/60 px-1.5 py-0.5 rounded text-civic mx-0.5 inline-block font-semibold select-all'>$1</span>");
  }

  return { __html: html };
}
