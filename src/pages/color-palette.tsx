import type { GetStaticProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";

const PAGE_SIZE = 50;

interface ImageData {
  base: string;
  source: string | null;
}

type Dataset = "babywear" | "footwear";

interface Props {
  babywearImages: ImageData[];
  footwearImages: ImageData[];
}

interface DominantColors {
  vibrant: { hex: string };
  vibrant_dark: { hex: string };
  vibrant_light: { hex: string };
  muted: { hex: string };
  muted_dark: { hex: string };
  muted_light: { hex: string };
}

interface PaletteColor {
  hex: string;
}

interface PaletteData {
  dominant_colors: DominantColors;
  colors: PaletteColor[];
  average_luminance: number;
}

type PaletteState = PaletteData | "loading" | "error";

interface VibrantPaletteData {
  dominant_colors: DominantColors;
}
type VibrantState = VibrantPaletteData | "loading" | "error";

interface BedrockPaletteData {
  hex: string;
}
type BedrockState = BedrockPaletteData | "loading" | { error: string };

interface PatternSwatchData {
  swatchUrl: string;
  coordinates: { x: number; y: number };
  size: number;
  reasoning?: string;
}
type PatternSwatchState = PatternSwatchData | "loading" | { error: string };

interface RekognitionSwatchData {
  swatchUrl: string;
  coordinates: { x: number; y: number };
  size: number;
  label?: string;
  confidence?: number;
}
type RekognitionSwatchState =
  | RekognitionSwatchData
  | "loading"
  | { error: string };

const DOMINANT_ORDER: { key: keyof DominantColors; label: string }[] = [
  { key: "vibrant", label: "Vibrant" },
  { key: "vibrant_dark", label: "Dark Vibrant" },
  { key: "vibrant_light", label: "Light Vibrant" },
  { key: "muted", label: "Muted" },
  { key: "muted_dark", label: "Dark Muted" },
  { key: "muted_light", label: "Light Muted" },
];

function isLight(hex: string | null | undefined): boolean {
  if (!hex || hex.length < 7) return false;
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}

function SwatchStrip({ palette }: { palette: PaletteData }) {
  return (
    <div className="space-y-3">
      {/* Dominant colors */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
          Dominant
        </p>
        <div className="flex gap-1.5 flex-wrap">
          {DOMINANT_ORDER.map(({ key, label }) => {
            const hex = palette.dominant_colors[key]?.hex;
            if (!hex) return null;
            const light = isLight(hex);
            return (
              <div
                key={key}
                className="rounded-lg flex flex-col items-center justify-center px-3 py-2 min-w-[80px]"
                style={{ backgroundColor: hex }}
              >
                <span
                  className="text-xs font-semibold leading-tight text-center"
                  style={{ color: light ? "#1e293b" : "#f8fafc" }}
                >
                  {label}
                </span>
                <span
                  className="text-xs font-mono mt-0.5 leading-tight"
                  style={{ color: light ? "#475569" : "#cbd5e1" }}
                >
                  {hex}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Raw colors */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
          Colors
        </p>
        <div className="flex gap-1.5 flex-wrap">
          {palette.colors.map((c) => {
            const light = isLight(c.hex);
            return (
              <div
                key={c.hex}
                className="rounded-lg flex flex-col items-center justify-center px-3 py-2 min-w-[72px]"
                style={{ backgroundColor: c.hex }}
              >
                <span
                  className="text-xs font-mono leading-tight"
                  style={{ color: light ? "#1e293b" : "#f8fafc" }}
                >
                  {c.hex}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DominantStrip({
  dominant_colors,
}: {
  dominant_colors: DominantColors;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
        Dominant
      </p>
      <div className="flex gap-1.5 flex-wrap">
        {DOMINANT_ORDER.map(({ key, label }) => {
          const hex = dominant_colors[key]?.hex;
          if (!hex) return null;
          const light = isLight(hex);
          return (
            <div
              key={key}
              className="rounded-lg flex flex-col items-center justify-center px-3 py-2 min-w-[80px]"
              style={{ backgroundColor: hex }}
            >
              <span
                className="text-xs font-semibold leading-tight text-center"
                style={{ color: light ? "#1e293b" : "#f8fafc" }}
              >
                {label}
              </span>
              <span
                className="text-xs font-mono mt-0.5 leading-tight"
                style={{ color: light ? "#475569" : "#cbd5e1" }}
              >
                {hex}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ColorPalettePage({
  babywearImages,
  footwearImages,
}: Props) {
  const [dataset, setDataset] = useState<Dataset>("babywear");
  const [page, setPage] = useState(0);
  const [palettes, setPalettes] = useState<Record<string, PaletteState>>({});
  const [vibrantPalettes, setVibrantPalettes] = useState<
    Record<string, VibrantState>
  >({});
  const [bedrockPalettes, setBedrockPalettes] = useState<
    Record<string, BedrockState>
  >({});
  const [patternSwatches, setPatternSwatches] = useState<
    Record<string, PatternSwatchState>
  >({});
  const [patternProSwatches, setPatternProSwatches] = useState<
    Record<string, PatternSwatchState>
  >({});
  const [haikuSwatches, setHaikuSwatches] = useState<
    Record<string, PatternSwatchState>
  >({});
  const [rekognitionSwatches, setRekognitionSwatches] = useState<
    Record<string, RekognitionSwatchState>
  >({});
  const [modal, setModal] = useState<{
    src: string;
    alt: string;
    base: string;
  } | null>(null);

  const images = dataset === "babywear" ? babywearImages : footwearImages;

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset state on dataset switch
  useEffect(() => {
    setPage(0);
    setPalettes({});
    setVibrantPalettes({});
    setBedrockPalettes({});
    setPatternSwatches({});
    setPatternProSwatches({});
    setHaikuSwatches({});
    setRekognitionSwatches({});
  }, [dataset]);

  const totalPages = Math.ceil(images.length / PAGE_SIZE);
  const pageImages = images.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // biome-ignore lint/correctness/useExhaustiveDependencies: page/dataset are the fetch triggers; palettes checked inside
  useEffect(() => {
    for (const img of pageImages) {
      if (!img.source || palettes[img.base]) continue;
      setPalettes((prev) => ({ ...prev, [img.base]: "loading" }));
      fetch(`/api/palette?url=${encodeURIComponent(img.source)}`)
        .then((r) => {
          if (!r.ok) throw new Error("failed");
          return r.json() as Promise<PaletteData>;
        })
        .then((data) => setPalettes((prev) => ({ ...prev, [img.base]: data })))
        .catch(() => setPalettes((prev) => ({ ...prev, [img.base]: "error" })));
    }
  }, [page, dataset]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: page/dataset are the fetch triggers; palettes checked inside
  useEffect(() => {
    for (const img of pageImages) {
      if (!img.source || vibrantPalettes[img.base]) continue;
      setVibrantPalettes((prev) => ({ ...prev, [img.base]: "loading" }));
      fetch(`/api/palette-vibrant?url=${encodeURIComponent(img.source)}`)
        .then((r) => {
          if (!r.ok) throw new Error("failed");
          return r.json() as Promise<VibrantPaletteData>;
        })
        .then((data) =>
          setVibrantPalettes((prev) => ({ ...prev, [img.base]: data })),
        )
        .catch(() =>
          setVibrantPalettes((prev) => ({ ...prev, [img.base]: "error" })),
        );
    }
  }, [page, dataset]);

  // Nova Lite in ap-southeast-2 is capped at 400 RPM — limit to 5 concurrent requests
  // biome-ignore lint/correctness/useExhaustiveDependencies: page/dataset are the fetch triggers; palettes checked inside
  useEffect(() => {
    const queue = pageImages.filter(
      (img) => img.source && !bedrockPalettes[img.base],
    );
    if (queue.length === 0) return;

    setBedrockPalettes((prev) => {
      const next = { ...prev };
      for (const img of queue) next[img.base] = "loading";
      return next;
    });

    const CONCURRENCY = 5;
    let active = 0;
    let idx = 0;

    function pump() {
      while (active < CONCURRENCY && idx < queue.length) {
        const img = queue[idx++];
        if (!img.source) continue;
        active++;
        fetch(`/api/palette-bedrock?url=${encodeURIComponent(img.source)}`)
          .then(async (r) => {
            if (!r.ok) {
              const body = await r.json().catch(() => ({}));
              throw new Error(
                (body as { error?: string }).error ?? `HTTP ${r.status}`,
              );
            }
            return r.json() as Promise<BedrockPaletteData>;
          })
          .then((data) =>
            setBedrockPalettes((prev) => ({ ...prev, [img.base]: data })),
          )
          .catch((err: unknown) =>
            setBedrockPalettes((prev) => ({
              ...prev,
              [img.base]: {
                error: err instanceof Error ? err.message : "Failed to load",
              },
            })),
          )
          .finally(() => {
            active--;
            pump();
          });
      }
    }
    pump();
  }, [page, dataset]);

  // Nova Lite Pattern swatches — same concurrency limit as Bedrock
  // biome-ignore lint/correctness/useExhaustiveDependencies: page/dataset are the fetch triggers; patternSwatches checked inside
  useEffect(() => {
    const queue = pageImages.filter(
      (img) => img.source && !patternSwatches[img.base],
    );
    if (queue.length === 0) return;

    setPatternSwatches((prev) => {
      const next = { ...prev };
      for (const img of queue) next[img.base] = "loading";
      return next;
    });

    const CONCURRENCY = 5;
    let active = 0;
    let idx = 0;

    function pump() {
      while (active < CONCURRENCY && idx < queue.length) {
        const img = queue[idx++];
        if (!img.source) continue;
        active++;
        fetch(
          `/api/palette-bedrock-pattern?url=${encodeURIComponent(img.source)}`,
        )
          .then(async (r) => {
            if (!r.ok) {
              const body = await r.json().catch(() => ({}));
              throw new Error(
                (body as { error?: string }).error ?? `HTTP ${r.status}`,
              );
            }
            return r.json() as Promise<PatternSwatchData>;
          })
          .then((data) =>
            setPatternSwatches((prev) => ({ ...prev, [img.base]: data })),
          )
          .catch((err: unknown) =>
            setPatternSwatches((prev) => ({
              ...prev,
              [img.base]: {
                error: err instanceof Error ? err.message : "Failed to load",
              },
            })),
          )
          .finally(() => {
            active--;
            pump();
          });
      }
    }
    pump();
  }, [page, dataset]);

  // Nova Pro Pattern swatches — same concurrency limit as Bedrock
  // biome-ignore lint/correctness/useExhaustiveDependencies: page/dataset are the fetch triggers; patternProSwatches checked inside
  useEffect(() => {
    const queue = pageImages.filter(
      (img) => img.source && !patternProSwatches[img.base],
    );
    if (queue.length === 0) return;

    setPatternProSwatches((prev) => {
      const next = { ...prev };
      for (const img of queue) next[img.base] = "loading";
      return next;
    });

    const CONCURRENCY = 5;
    let active = 0;
    let idx = 0;

    function pump() {
      while (active < CONCURRENCY && idx < queue.length) {
        const img = queue[idx++];
        if (!img.source) continue;
        active++;
        fetch(
          `/api/palette-bedrock-pattern-pro?url=${encodeURIComponent(img.source)}`,
        )
          .then(async (r) => {
            if (!r.ok) {
              const body = await r.json().catch(() => ({}));
              throw new Error(
                (body as { error?: string }).error ?? `HTTP ${r.status}`,
              );
            }
            return r.json() as Promise<PatternSwatchData>;
          })
          .then((data) =>
            setPatternProSwatches((prev) => ({ ...prev, [img.base]: data })),
          )
          .catch((err: unknown) =>
            setPatternProSwatches((prev) => ({
              ...prev,
              [img.base]: {
                error: err instanceof Error ? err.message : "Failed to load",
              },
            })),
          )
          .finally(() => {
            active--;
            pump();
          });
      }
    }
    pump();
  }, [page, dataset]);

  // Claude Haiku Pattern swatches — same concurrency limit as Bedrock
  // biome-ignore lint/correctness/useExhaustiveDependencies: page/dataset are the fetch triggers; haikuSwatches checked inside
  useEffect(() => {
    const queue = pageImages.filter(
      (img) => img.source && !haikuSwatches[img.base],
    );
    if (queue.length === 0) return;

    setHaikuSwatches((prev) => {
      const next = { ...prev };
      for (const img of queue) next[img.base] = "loading";
      return next;
    });

    const CONCURRENCY = 5;
    let active = 0;
    let idx = 0;

    function pump() {
      while (active < CONCURRENCY && idx < queue.length) {
        const img = queue[idx++];
        if (!img.source) continue;
        active++;
        fetch(
          `/api/palette-claude-haiku-pattern?url=${encodeURIComponent(img.source)}`,
        )
          .then(async (r) => {
            if (!r.ok) {
              const body = await r.json().catch(() => ({}));
              throw new Error(
                (body as { error?: string }).error ?? `HTTP ${r.status}`,
              );
            }
            return r.json() as Promise<PatternSwatchData>;
          })
          .then((data) =>
            setHaikuSwatches((prev) => ({ ...prev, [img.base]: data })),
          )
          .catch((err: unknown) =>
            setHaikuSwatches((prev) => ({
              ...prev,
              [img.base]: {
                error: err instanceof Error ? err.message : "Failed to load",
              },
            })),
          )
          .finally(() => {
            active--;
            pump();
          });
      }
    }
    pump();
  }, [page, dataset]);

  // Rekognition pattern swatches — same concurrency limit
  // biome-ignore lint/correctness/useExhaustiveDependencies: page/dataset are the fetch triggers; rekognitionSwatches checked inside
  useEffect(() => {
    const queue = pageImages.filter(
      (img) => img.source && !rekognitionSwatches[img.base],
    );
    if (queue.length === 0) return;

    setRekognitionSwatches((prev) => {
      const next = { ...prev };
      for (const img of queue) next[img.base] = "loading";
      return next;
    });

    const CONCURRENCY = 5;
    let active = 0;
    let idx = 0;

    function pump() {
      while (active < CONCURRENCY && idx < queue.length) {
        const img = queue[idx++];
        if (!img.source) continue;
        active++;
        fetch(`/api/palette-rekognition?url=${encodeURIComponent(img.source)}`)
          .then(async (r) => {
            if (!r.ok) {
              const body = await r.json().catch(() => ({}));
              throw new Error(
                (body as { error?: string }).error ?? `HTTP ${r.status}`,
              );
            }
            return r.json() as Promise<RekognitionSwatchData>;
          })
          .then((data) =>
            setRekognitionSwatches((prev) => ({ ...prev, [img.base]: data })),
          )
          .catch((err: unknown) =>
            setRekognitionSwatches((prev) => ({
              ...prev,
              [img.base]: {
                error: err instanceof Error ? err.message : "Failed to load",
              },
            })),
          )
          .finally(() => {
            active--;
            pump();
          });
      }
    }
    pump();
  }, [page, dataset]);

  return (
    <>
      <Head>
        <title>Color Palette — Image Transformations</title>
      </Head>

      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-8 py-5 sticky top-0 z-10">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-slate-800 tracking-tight">
                Color Palette
              </h1>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="dataset-select"
                  className="text-xs font-medium text-slate-500"
                >
                  Source data
                </label>
                <select
                  id="dataset-select"
                  value={dataset}
                  onChange={(e) => setDataset(e.target.value as Dataset)}
                  className="text-sm rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="babywear">Babywear</option>
                  <option value="footwear">Footwear</option>
                </select>
              </div>
            </div>
            <nav className="flex gap-4 text-sm font-medium">
              <Link
                href="/"
                className="text-slate-500 hover:text-slate-800 transition-colors"
              >
                Image Comparison
              </Link>
              <Link
                href="/color-palette"
                className="text-violet-600 border-b border-violet-400 pb-0.5"
              >
                Color Palette
              </Link>
            </nav>
          </div>
        </header>

        <main className="px-8 py-6 max-w-7xl mx-auto">
          <div className="rounded-xl border border-violet-200 bg-violet-50 shadow-sm overflow-hidden">
            <table className="w-full border-collapse table-fixed">
              <thead>
                <tr className="bg-violet-100 border-b border-violet-200">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-violet-500 uppercase tracking-wider w-1/5">
                    Source
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-violet-500 uppercase tracking-wider w-1/5">
                    imgix Palette
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-violet-500 uppercase tracking-wider w-1/5">
                    Node Vibrant
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-violet-500 uppercase tracking-wider w-1/5">
                    AWS Nova Lite
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-violet-500 uppercase tracking-wider w-1/5">
                    Nova Lite Pattern
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-violet-500 uppercase tracking-wider w-1/5">
                    Nova Pro Pattern
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-violet-500 uppercase tracking-wider w-1/5">
                    Claude Haiku Pattern
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-violet-500 uppercase tracking-wider w-1/5">
                    Rekognition
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-violet-100">
                {pageImages.map((img) => {
                  const state = palettes[img.base];
                  return (
                    <tr
                      key={img.base}
                      className="hover:bg-violet-200/40 transition-colors duration-150"
                    >
                      <td className="px-5 py-4 align-top">
                        {img.source && (
                          <button
                            type="button"
                            onClick={() =>
                              setModal({
                                src: img.source as string,
                                alt: `Source: ${img.base}`,
                                base: img.base,
                              })
                            }
                            className="group text-left w-full"
                          >
                            {/* biome-ignore lint/performance/noImgElement: Cloudinary CDN handles optimization */}
                            <img
                              src={img.source}
                              alt={`Source: ${img.base}`}
                              className="w-full max-h-48 object-contain rounded-md transition-transform duration-150 group-hover:scale-[1.02] cursor-pointer"
                            />
                          </button>
                        )}
                        <p className="text-xs text-slate-400 mt-1.5 font-mono truncate">
                          {img.base}
                        </p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        {!state || state === "loading" ? (
                          <div className="flex gap-1.5">
                            {Array.from("123456").map((k) => (
                              <div
                                key={k}
                                className="w-20 h-12 rounded-lg bg-slate-200 animate-pulse"
                              />
                            ))}
                          </div>
                        ) : state === "error" ? (
                          <span className="text-xs text-red-400">
                            Failed to load palette
                          </span>
                        ) : (
                          <SwatchStrip palette={state} />
                        )}
                      </td>
                      <td className="px-5 py-4 align-top">
                        {(() => {
                          const vState = vibrantPalettes[img.base];
                          if (!vState || vState === "loading") {
                            return (
                              <div className="flex gap-1.5">
                                {Array.from("123456").map((k) => (
                                  <div
                                    key={k}
                                    className="w-20 h-12 rounded-lg bg-slate-200 animate-pulse"
                                  />
                                ))}
                              </div>
                            );
                          }
                          if (vState === "error") {
                            return (
                              <span className="text-xs text-red-400">
                                Failed to load palette
                              </span>
                            );
                          }
                          return (
                            <DominantStrip
                              dominant_colors={vState.dominant_colors}
                            />
                          );
                        })()}
                      </td>
                      <td className="px-5 py-4 align-top">
                        {(() => {
                          const bState = bedrockPalettes[img.base];
                          if (!bState || bState === "loading") {
                            return (
                              <div className="w-20 h-12 rounded-lg bg-slate-200 animate-pulse" />
                            );
                          }
                          if (typeof bState === "object" && "error" in bState) {
                            return (
                              <span className="text-xs text-red-400">
                                {bState.error}
                              </span>
                            );
                          }
                          if (!bState.hex) {
                            return (
                              <span className="text-xs text-red-400">
                                No color returned
                              </span>
                            );
                          }
                          const light = isLight(bState.hex);
                          return (
                            <div
                              className="rounded-lg flex flex-col items-center justify-center px-4 py-3 w-24 h-14"
                              style={{ backgroundColor: bState.hex }}
                            >
                              <span
                                className="text-xs font-mono leading-tight"
                                style={{ color: light ? "#1e293b" : "#f8fafc" }}
                              >
                                {bState.hex}
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-4 align-top">
                        {(() => {
                          const pState = patternSwatches[img.base];
                          if (!pState || pState === "loading") {
                            return (
                              <div className="w-20 h-20 rounded-lg bg-slate-200 animate-pulse" />
                            );
                          }
                          if (typeof pState === "object" && "error" in pState) {
                            return (
                              <span className="text-xs text-red-400">
                                {pState.error}
                              </span>
                            );
                          }
                          return (
                            <div className="flex flex-col items-start gap-1">
                              {/* biome-ignore lint/performance/noImgElement: swatch served from local static */}
                              <img
                                src={pState.swatchUrl}
                                alt={`Swatch: ${img.base}`}
                                width={pState.size}
                                height={pState.size}
                                className="rounded-lg border border-slate-200"
                              />
                              {/* biome-ignore lint/performance/noImgElement: swatch served from local static */}
                              <img
                                src={pState.swatchUrl}
                                alt={`Swatch 80px: ${img.base}`}
                                width={80}
                                height={80}
                                className="rounded-lg border border-slate-200"
                                style={{
                                  width: 80,
                                  height: 80,
                                  objectFit: "cover",
                                }}
                              />
                              {pState.coordinates && (
                                <span className="text-xs text-slate-400 font-mono">
                                  {pState.coordinates.x},{pState.coordinates.y}{" "}
                                  ({pState.size}px)
                                </span>
                              )}
                              {pState.reasoning && (
                                <p className="text-xs text-slate-500 max-w-xs">
                                  {pState.reasoning}
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-4 align-top">
                        {(() => {
                          const pState = patternProSwatches[img.base];
                          if (!pState || pState === "loading") {
                            return (
                              <div className="w-20 h-20 rounded-lg bg-slate-200 animate-pulse" />
                            );
                          }
                          if (typeof pState === "object" && "error" in pState) {
                            return (
                              <span className="text-xs text-red-400">
                                {pState.error}
                              </span>
                            );
                          }
                          return (
                            <div className="flex flex-col items-start gap-1">
                              {/* biome-ignore lint/performance/noImgElement: swatch served from local static */}
                              <img
                                src={pState.swatchUrl}
                                alt={`Swatch Pro: ${img.base}`}
                                width={pState.size}
                                height={pState.size}
                                className="rounded-lg border border-slate-200"
                              />
                              {/* biome-ignore lint/performance/noImgElement: swatch served from local static */}
                              <img
                                src={pState.swatchUrl}
                                alt={`Swatch Pro 80px: ${img.base}`}
                                width={80}
                                height={80}
                                className="rounded-lg border border-slate-200"
                                style={{
                                  width: 80,
                                  height: 80,
                                  objectFit: "cover",
                                }}
                              />
                              {pState.coordinates && (
                                <span className="text-xs text-slate-400 font-mono">
                                  {pState.coordinates.x},{pState.coordinates.y}{" "}
                                  ({pState.size}px)
                                </span>
                              )}
                              {pState.reasoning && (
                                <p className="text-xs text-slate-500 max-w-xs">
                                  {pState.reasoning}
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-4 align-top">
                        {(() => {
                          const hState = haikuSwatches[img.base];
                          if (!hState || hState === "loading") {
                            return (
                              <div className="w-20 h-20 rounded-lg bg-slate-200 animate-pulse" />
                            );
                          }
                          if (typeof hState === "object" && "error" in hState) {
                            return (
                              <span className="text-xs text-red-400">
                                {hState.error}
                              </span>
                            );
                          }
                          return (
                            <div className="flex flex-col items-start gap-1">
                              {/* biome-ignore lint/performance/noImgElement: swatch served from local static */}
                              <img
                                src={hState.swatchUrl}
                                alt={`Haiku Swatch: ${img.base}`}
                                width={hState.size}
                                height={hState.size}
                                className="rounded-lg border border-slate-200"
                              />
                              {/* biome-ignore lint/performance/noImgElement: swatch served from local static */}
                              <img
                                src={hState.swatchUrl}
                                alt={`Haiku Swatch 80px: ${img.base}`}
                                width={80}
                                height={80}
                                className="rounded-lg border border-slate-200"
                                style={{
                                  width: 80,
                                  height: 80,
                                  objectFit: "cover",
                                }}
                              />
                              {hState.coordinates && (
                                <span className="text-xs text-slate-400 font-mono">
                                  {hState.coordinates.x},{hState.coordinates.y}{" "}
                                  ({hState.size}px)
                                </span>
                              )}
                              {hState.reasoning && (
                                <p className="text-xs text-slate-500 max-w-xs">
                                  {hState.reasoning}
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-4 align-top">
                        {(() => {
                          const rState = rekognitionSwatches[img.base];
                          if (!rState || rState === "loading") {
                            return (
                              <div className="w-20 h-20 rounded-lg bg-slate-200 animate-pulse" />
                            );
                          }
                          if (typeof rState === "object" && "error" in rState) {
                            return (
                              <span className="text-xs text-red-400">
                                {rState.error}
                              </span>
                            );
                          }
                          return (
                            <div className="flex flex-col items-start gap-1">
                              {/* biome-ignore lint/performance/noImgElement: swatch served from local static */}
                              <img
                                src={rState.swatchUrl}
                                alt={`Rekognition Swatch: ${img.base}`}
                                width={rState.size}
                                height={rState.size}
                                className="rounded-lg border border-slate-200"
                              />
                              {/* biome-ignore lint/performance/noImgElement: swatch served from local static */}
                              <img
                                src={rState.swatchUrl}
                                alt={`Rekognition Swatch 80px: ${img.base}`}
                                width={80}
                                height={80}
                                className="rounded-lg border border-slate-200"
                                style={{
                                  width: 80,
                                  height: 80,
                                  objectFit: "cover",
                                }}
                              />
                              {rState.coordinates && (
                                <span className="text-xs text-slate-400 font-mono">
                                  {rState.coordinates.x},{rState.coordinates.y}{" "}
                                  ({rState.size}px)
                                </span>
                              )}
                              {rState.label && (
                                <span className="text-xs text-slate-500">
                                  {rState.label}
                                  {rState.confidence !== undefined
                                    ? ` (${rState.confidence}%)`
                                    : ""}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-5">
            <span className="text-sm text-slate-500">
              Page{" "}
              <span className="font-medium text-slate-700">{page + 1}</span> of{" "}
              <span className="font-medium text-slate-700">{totalPages}</span>
              <span className="text-slate-400 ml-1">
                ({images.length} images)
              </span>
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-4 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="px-4 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        </main>
      </div>

      {modal && (
        <dialog
          open
          aria-modal="true"
          aria-label={modal.alt}
          className="fixed inset-0 w-full h-full bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6 border-0"
          onKeyDown={(e) => e.key === "Escape" && setModal(null)}
        >
          <button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 w-full h-full cursor-default"
            onClick={() => setModal(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto z-10">
            <button
              type="button"
              onClick={() => setModal(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white border border-slate-200 shadow-md text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors flex items-center justify-center text-sm font-bold"
            >
              ✕
            </button>
            {/* biome-ignore lint/performance/noImgElement: modal needs unrestricted sizing */}
            <img
              src={modal.src}
              alt={modal.alt}
              className="max-w-full max-h-[55vh] object-contain rounded-lg mx-auto block"
            />
            <p className="text-xs text-slate-400 mt-2 text-center font-mono truncate mb-5">
              {modal.alt}
            </p>
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  imgix Palette
                </p>
                {(() => {
                  const state = palettes[modal.base];
                  if (!state || state === "loading") {
                    return (
                      <div className="flex gap-1.5 flex-wrap">
                        {Array.from("123456").map((k) => (
                          <div
                            key={k}
                            className="w-24 h-14 rounded-lg bg-slate-200 animate-pulse"
                          />
                        ))}
                      </div>
                    );
                  }
                  if (state === "error") {
                    return (
                      <p className="text-xs text-red-400">
                        Failed to load palette
                      </p>
                    );
                  }
                  return <SwatchStrip palette={state} />;
                })()}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Node Vibrant
                </p>
                {(() => {
                  const vState = vibrantPalettes[modal.base];
                  if (!vState || vState === "loading") {
                    return (
                      <div className="flex gap-1.5 flex-wrap">
                        {Array.from("123456").map((k) => (
                          <div
                            key={k}
                            className="w-24 h-14 rounded-lg bg-slate-200 animate-pulse"
                          />
                        ))}
                      </div>
                    );
                  }
                  if (vState === "error") {
                    return (
                      <p className="text-xs text-red-400">
                        Failed to load palette
                      </p>
                    );
                  }
                  return (
                    <DominantStrip dominant_colors={vState.dominant_colors} />
                  );
                })()}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  AWS Nova Lite
                </p>
                {(() => {
                  const bState = bedrockPalettes[modal.base];
                  if (!bState || bState === "loading") {
                    return (
                      <div className="w-24 h-14 rounded-lg bg-slate-200 animate-pulse" />
                    );
                  }
                  if (typeof bState === "object" && "error" in bState) {
                    return (
                      <p className="text-xs text-red-400">{bState.error}</p>
                    );
                  }
                  const light = isLight(bState.hex);
                  return (
                    <div
                      className="rounded-lg flex flex-col items-center justify-center px-4 py-3 w-24 h-14"
                      style={{ backgroundColor: bState.hex }}
                    >
                      <span
                        className="text-xs font-mono leading-tight"
                        style={{ color: light ? "#1e293b" : "#f8fafc" }}
                      >
                        {bState.hex}
                      </span>
                    </div>
                  );
                })()}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Nova Lite Pattern
                </p>
                {(() => {
                  const pState = patternSwatches[modal.base];
                  if (!pState || pState === "loading") {
                    return (
                      <div className="w-24 h-24 rounded-lg bg-slate-200 animate-pulse" />
                    );
                  }
                  if (typeof pState === "object" && "error" in pState) {
                    return (
                      <p className="text-xs text-red-400">{pState.error}</p>
                    );
                  }
                  return (
                    <div className="flex flex-col items-start gap-2">
                      {/* biome-ignore lint/performance/noImgElement: swatch served from local static */}
                      <img
                        src={pState.swatchUrl}
                        alt={`Swatch: ${modal.base}`}
                        width={pState.size}
                        height={pState.size}
                        className="rounded-lg border border-slate-200"
                      />
                      {pState.coordinates && (
                        <span className="text-xs text-slate-400 font-mono">
                          rect: {pState.coordinates.x},{pState.coordinates.y},
                          {pState.size},{pState.size}
                        </span>
                      )}
                      {pState.reasoning && (
                        <p className="text-xs text-slate-500 max-w-md">
                          {pState.reasoning}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Nova Pro Pattern
                </p>
                {(() => {
                  const pState = patternProSwatches[modal.base];
                  if (!pState || pState === "loading") {
                    return (
                      <div className="w-24 h-24 rounded-lg bg-slate-200 animate-pulse" />
                    );
                  }
                  if (typeof pState === "object" && "error" in pState) {
                    return (
                      <p className="text-xs text-red-400">{pState.error}</p>
                    );
                  }
                  return (
                    <div className="flex flex-col items-start gap-2">
                      {/* biome-ignore lint/performance/noImgElement: swatch served from local static */}
                      <img
                        src={pState.swatchUrl}
                        alt={`Swatch Pro: ${modal.base}`}
                        width={pState.size}
                        height={pState.size}
                        className="rounded-lg border border-slate-200"
                      />
                      {pState.coordinates && (
                        <span className="text-xs text-slate-400 font-mono">
                          rect: {pState.coordinates.x},{pState.coordinates.y},
                          {pState.size},{pState.size}
                        </span>
                      )}
                      {pState.reasoning && (
                        <p className="text-xs text-slate-500 max-w-md">
                          {pState.reasoning}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Rekognition
                </p>
                {(() => {
                  const rState = rekognitionSwatches[modal.base];
                  if (!rState || rState === "loading") {
                    return (
                      <div className="w-24 h-24 rounded-lg bg-slate-200 animate-pulse" />
                    );
                  }
                  if (typeof rState === "object" && "error" in rState) {
                    return (
                      <p className="text-xs text-red-400">{rState.error}</p>
                    );
                  }
                  return (
                    <div className="flex flex-col items-start gap-2">
                      {/* biome-ignore lint/performance/noImgElement: swatch served from local static */}
                      <img
                        src={rState.swatchUrl}
                        alt={`Rekognition Swatch: ${modal.base}`}
                        width={rState.size}
                        height={rState.size}
                        className="rounded-lg border border-slate-200"
                      />
                      {rState.coordinates && (
                        <span className="text-xs text-slate-400 font-mono">
                          rect: {rState.coordinates.x},{rState.coordinates.y},
                          {rState.size},{rState.size}
                        </span>
                      )}
                      {rState.label && (
                        <p className="text-xs text-slate-500 max-w-md">
                          {rState.label}
                          {rState.confidence !== undefined
                            ? ` (${rState.confidence}%)`
                            : ""}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const { default: babywear } = await import("@/data/images.json");
  const { default: footwear } = await import("@/data/images-footwear.json");
  const toImageData = (arr: { base: string; source?: string | null }[]) =>
    arr.map(({ base, source }) => ({ base, source: source ?? null }));
  return {
    props: {
      babywearImages: toImageData(
        babywear as { base: string; source?: string | null }[],
      ),
      footwearImages: toImageData(
        footwear as { base: string; source?: string | null }[],
      ),
    },
  };
};
