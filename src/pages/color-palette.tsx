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

const DOMINANT_ORDER: { key: keyof DominantColors; label: string }[] = [
  { key: "vibrant", label: "Vibrant" },
  { key: "vibrant_dark", label: "Dark Vibrant" },
  { key: "vibrant_light", label: "Light Vibrant" },
  { key: "muted", label: "Muted" },
  { key: "muted_dark", label: "Dark Muted" },
  { key: "muted_light", label: "Light Muted" },
];

function isLight(hex: string): boolean {
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
                  <th className="px-5 py-3 text-left text-xs font-semibold text-violet-500 uppercase tracking-wider w-1/3">
                    Source
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-violet-500 uppercase tracking-wider w-1/3">
                    imgix Palette
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-violet-500 uppercase tracking-wider w-1/3">
                    Node Vibrant
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
