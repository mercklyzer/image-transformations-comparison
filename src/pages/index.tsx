import type { GetStaticProps } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";

const PAGE_SIZE = 50;

type ReviewStatus = "accepted" | "rejected" | "ignore";
type Reviews = Record<string, ReviewStatus>;
type Filter = "all" | "accepted" | "rejected" | "ignored" | "undecided";

interface ImageData {
  base: string;
  source: string | null;
  photoroom: string | null;
  "birefnet-general-lite": string | null;
}

interface Props {
  images: ImageData[];
}

function photoroomKey(base: string) {
  return `photoroom:${base}.png`;
}

function birefnetKey(base: string) {
  return `birefnet:${base}.png`;
}

export default function Home({ images }: Props) {
  const [page, setPage] = useState(0);
  const [photoroomFilter, setPhotoroomFilter] = useState<Filter>("all");
  const [birefnetFilter, setBirefnetFilter] = useState<Filter>("all");
  const [modal, setModal] = useState<{ src: string; alt: string } | null>(null);
  const [reviews, setReviews] = useState<Reviews>({});

  const closeModal = () => setModal(null);

  useEffect(() => {
    fetch("/api/reviews")
      .then((r) => r.json())
      .then((data: Reviews) => setReviews(data));
  }, []);

  async function handleReview(key: string, status: ReviewStatus) {
    const current = reviews[key];
    const next = current === status ? null : status;

    setReviews((prev) => {
      const updated = { ...prev };
      if (next === null) delete updated[key];
      else updated[key] = next;
      return updated;
    });

    await fetch(`/api/reviews/${encodeURIComponent(key)}`, {
      method: next === null ? "DELETE" : "POST",
      headers: next ? { "Content-Type": "application/json" } : {},
      body: next ? JSON.stringify({ status: next }) : undefined,
    });
  }

  function handlePhotoroomFilter(f: Filter) {
    setPhotoroomFilter(f);
    setPage(0);
  }

  function handleBirefnetFilter(f: Filter) {
    setBirefnetFilter(f);
    setPage(0);
  }

  const photoroomStats = {
    total: images.length,
    accepted: images.filter((img) => reviews[photoroomKey(img.base)] === "accepted").length,
    rejected: images.filter((img) => reviews[photoroomKey(img.base)] === "rejected").length,
    ignored: images.filter((img) => reviews[photoroomKey(img.base)] === "ignore").length,
    undecided: images.filter((img) => !reviews[photoroomKey(img.base)]).length,
  };
  const photoroomReviewedPct = Math.round(
    ((photoroomStats.accepted + photoroomStats.rejected + photoroomStats.ignored) / photoroomStats.total) * 100,
  );

  const birefnetStats = {
    total: images.length,
    accepted: images.filter((img) => reviews[birefnetKey(img.base)] === "accepted").length,
    rejected: images.filter((img) => reviews[birefnetKey(img.base)] === "rejected").length,
    ignored: images.filter((img) => reviews[birefnetKey(img.base)] === "ignore").length,
    undecided: images.filter((img) => !reviews[birefnetKey(img.base)]).length,
  };
  const birefnetReviewedPct = Math.round(
    ((birefnetStats.accepted + birefnetStats.rejected + birefnetStats.ignored) / birefnetStats.total) * 100,
  );

  const filteredImages = images.filter((img) => {
    const prk = photoroomKey(img.base);
    const bfk = birefnetKey(img.base);
    const matchPhotoroom =
      photoroomFilter === "all" ||
      (photoroomFilter === "accepted" && reviews[prk] === "accepted") ||
      (photoroomFilter === "rejected" && reviews[prk] === "rejected") ||
      (photoroomFilter === "ignored" && reviews[prk] === "ignore") ||
      (photoroomFilter === "undecided" && !reviews[prk]);
    const matchBirefnet =
      birefnetFilter === "all" ||
      (birefnetFilter === "accepted" && reviews[bfk] === "accepted") ||
      (birefnetFilter === "rejected" && reviews[bfk] === "rejected") ||
      (birefnetFilter === "ignored" && reviews[bfk] === "ignore") ||
      (birefnetFilter === "undecided" && !reviews[bfk]);
    return matchPhotoroom && matchBirefnet;
  });

  const totalPages = Math.ceil(filteredImages.length / PAGE_SIZE);
  const pageImages = filteredImages.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );

  return (
    <>
      <Head>
        <title>Image Transformation Comparison</title>
      </Head>

      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-8 py-5 sticky top-0 z-10">
          <h1 className="text-xl font-semibold text-slate-800 tracking-tight">
            Image Transformation Comparison
          </h1>
        </header>

        <main className="px-8 py-6 max-w-7xl mx-auto">
          {/* Birefnet General Lite Stats */}
          <div className="mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Birefnet General Lite</p>
            <div className="grid grid-cols-5 gap-3">
              {(
                [
                  { key: "all", label: "Total", count: birefnetStats.total, color: "violet" },
                  { key: "accepted", label: "Accepted", count: birefnetStats.accepted, color: "emerald" },
                  { key: "rejected", label: "Rejected", count: birefnetStats.rejected, color: "red" },
                  { key: "ignored", label: "Ignored", count: birefnetStats.ignored, color: "amber" },
                  { key: "undecided", label: "Undecided", count: birefnetStats.undecided, color: "slate" },
                ] as const
              ).map(({ key, label, count, color }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleBirefnetFilter(key)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    birefnetFilter === key
                      ? color === "violet"
                        ? "bg-violet-100 border-violet-400 shadow-sm"
                        : color === "emerald"
                          ? "bg-emerald-100 border-emerald-400 shadow-sm"
                          : color === "red"
                            ? "bg-red-100 border-red-400 shadow-sm"
                            : color === "amber"
                              ? "bg-amber-100 border-amber-400 shadow-sm"
                              : "bg-slate-100 border-slate-400 shadow-sm"
                      : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  <p
                    className={`text-2xl font-bold ${
                      birefnetFilter === key
                        ? color === "violet"
                          ? "text-violet-700"
                          : color === "emerald"
                            ? "text-emerald-700"
                            : color === "red"
                              ? "text-red-700"
                              : color === "amber"
                                ? "text-amber-700"
                                : "text-slate-700"
                        : "text-slate-800"
                    }`}
                  >
                    {count}
                  </p>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                    {label}
                  </p>
                </button>
              ))}
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Review progress</span>
                <span className="font-medium text-slate-700">
                  {birefnetStats.accepted + birefnetStats.rejected + birefnetStats.ignored} / {birefnetStats.total} ({birefnetReviewedPct}%)
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${(birefnetStats.accepted / birefnetStats.total) * 100}%` }} />
                <div className="h-full bg-red-400 transition-all duration-500" style={{ width: `${(birefnetStats.rejected / birefnetStats.total) * 100}%` }} />
                <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${(birefnetStats.ignored / birefnetStats.total) * 100}%` }} />
              </div>
            </div>
          </div>

          {/* Photoroom Stats */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Photoroom</p>
            <div className="grid grid-cols-5 gap-3">
              {(
                [
                  { key: "all", label: "Total", count: photoroomStats.total, color: "violet" },
                  { key: "accepted", label: "Accepted", count: photoroomStats.accepted, color: "emerald" },
                  { key: "rejected", label: "Rejected", count: photoroomStats.rejected, color: "red" },
                  { key: "ignored", label: "Ignored", count: photoroomStats.ignored, color: "amber" },
                  { key: "undecided", label: "Undecided", count: photoroomStats.undecided, color: "slate" },
                ] as const
              ).map(({ key, label, count, color }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handlePhotoroomFilter(key)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    photoroomFilter === key
                      ? color === "violet"
                        ? "bg-violet-100 border-violet-400 shadow-sm"
                        : color === "emerald"
                          ? "bg-emerald-100 border-emerald-400 shadow-sm"
                          : color === "red"
                            ? "bg-red-100 border-red-400 shadow-sm"
                            : color === "amber"
                              ? "bg-amber-100 border-amber-400 shadow-sm"
                              : "bg-slate-100 border-slate-400 shadow-sm"
                      : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  <p
                    className={`text-2xl font-bold ${
                      photoroomFilter === key
                        ? color === "violet"
                          ? "text-violet-700"
                          : color === "emerald"
                            ? "text-emerald-700"
                            : color === "red"
                              ? "text-red-700"
                              : color === "amber"
                                ? "text-amber-700"
                                : "text-slate-700"
                        : "text-slate-800"
                    }`}
                  >
                    {count}
                  </p>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                    {label}
                  </p>
                </button>
              ))}
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Review progress</span>
                <span className="font-medium text-slate-700">
                  {photoroomStats.accepted + photoroomStats.rejected + photoroomStats.ignored} / {photoroomStats.total} ({photoroomReviewedPct}%)
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${(photoroomStats.accepted / photoroomStats.total) * 100}%` }} />
                <div className="h-full bg-red-400 transition-all duration-500" style={{ width: `${(photoroomStats.rejected / photoroomStats.total) * 100}%` }} />
                <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${(photoroomStats.ignored / photoroomStats.total) * 100}%` }} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-violet-200 bg-violet-50 shadow-sm overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-violet-100 border-b border-violet-200">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-violet-500 uppercase tracking-wider w-1/3">
                    Source
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-violet-500 uppercase tracking-wider w-1/3">
                    Birefnet General Lite
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-violet-500 uppercase tracking-wider w-1/3">
                    Photoroom
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-violet-100">
                {pageImages.map((img) => {
                  const prk = photoroomKey(img.base);
                  const bfk = birefnetKey(img.base);
                  const photoroomStatus = reviews[prk];
                  const birefnetStatus = reviews[bfk];
                  return (
                    <tr
                      key={img.base}
                      className="transition-colors duration-150 hover:bg-violet-200/60"
                    >
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            img.source && setModal({
                              src: img.source,
                              alt: `Source: ${img.base}`,
                            })
                          }
                          className="group text-left w-full"
                        >
                          {/* biome-ignore lint/performance/noImgElement: Cloudinary CDN handles optimization */}
                          {img.source && (
                            <img
                              src={img.source}
                              alt={`Source: ${img.base}`}
                              className="max-h-48 object-contain rounded-md transition-transform duration-150 group-hover:scale-[1.02] cursor-pointer"
                            />
                          )}
                          <p className="text-xs text-slate-400 mt-2 truncate font-mono">
                            {img.base}
                          </p>
                        </button>
                      </td>
                      <td className={`px-5 py-4 ${
                        birefnetStatus === "accepted"
                          ? "bg-emerald-50"
                          : birefnetStatus === "rejected"
                            ? "bg-red-50"
                            : birefnetStatus === "ignore"
                              ? "bg-amber-50"
                              : ""
                      }`}>
                        <button
                          type="button"
                          onClick={() =>
                            img["birefnet-general-lite"] && setModal({
                              src: img["birefnet-general-lite"],
                              alt: `Birefnet General Lite: ${img.base}`,
                            })
                          }
                          className="group text-left w-full"
                        >
                          {img["birefnet-general-lite"] && (
                            // biome-ignore lint/performance/noImgElement: Cloudinary CDN handles optimization
                            <img
                              src={img["birefnet-general-lite"]}
                              alt={`Birefnet General Lite: ${img.base}`}
                              className="max-h-48 object-contain rounded-md transition-transform duration-150 group-hover:scale-[1.02] cursor-pointer"
                            />
                          )}
                          <p className="text-xs text-slate-400 mt-2 truncate font-mono">
                            {img.base}.png
                          </p>
                        </button>
                        <div className="flex gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => handleReview(bfk, "accepted")}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                              birefnetStatus === "accepted"
                                ? "bg-emerald-500 text-white shadow-sm"
                                : "border border-slate-200 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50"
                            }`}
                          >
                            <span>✓</span> Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReview(bfk, "rejected")}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                              birefnetStatus === "rejected"
                                ? "bg-red-500 text-white shadow-sm"
                                : "border border-slate-200 text-slate-500 hover:border-red-400 hover:text-red-600 hover:bg-red-50"
                            }`}
                          >
                            <span>✕</span> Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReview(bfk, "ignore")}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                              birefnetStatus === "ignore"
                                ? "bg-amber-500 text-white shadow-sm"
                                : "border border-slate-200 text-slate-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50"
                            }`}
                          >
                            <span>—</span> Ignore
                          </button>
                        </div>
                      </td>
                      <td className={`px-5 py-4 ${
                        photoroomStatus === "accepted"
                          ? "bg-emerald-50"
                          : photoroomStatus === "rejected"
                            ? "bg-red-50"
                            : photoroomStatus === "ignore"
                              ? "bg-amber-50"
                              : ""
                      }`}>
                        <button
                          type="button"
                          onClick={() =>
                            img.photoroom && setModal({
                              src: img.photoroom,
                              alt: `Photoroom: ${img.base}`,
                            })
                          }
                          className="group text-left w-full"
                        >
                          {img.photoroom && (
                            // biome-ignore lint/performance/noImgElement: Cloudinary CDN handles optimization
                            <img
                              src={img.photoroom}
                              alt={`Photoroom: ${img.base}`}
                              className="max-h-48 object-contain rounded-md transition-transform duration-150 group-hover:scale-[1.02] cursor-pointer"
                            />
                          )}
                          <p className="text-xs text-slate-400 mt-2 truncate font-mono">
                            {img.base}.png
                          </p>
                        </button>
                        <div className="flex gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => handleReview(prk, "accepted")}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                              photoroomStatus === "accepted"
                                ? "bg-emerald-500 text-white shadow-sm"
                                : "border border-slate-200 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50"
                            }`}
                          >
                            <span>✓</span> Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReview(prk, "rejected")}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                              photoroomStatus === "rejected"
                                ? "bg-red-500 text-white shadow-sm"
                                : "border border-slate-200 text-slate-500 hover:border-red-400 hover:text-red-600 hover:bg-red-50"
                            }`}
                          >
                            <span>✕</span> Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReview(prk, "ignore")}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                              photoroomStatus === "ignore"
                                ? "bg-amber-500 text-white shadow-sm"
                                : "border border-slate-200 text-slate-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50"
                            }`}
                          >
                            <span>—</span> Ignore
                          </button>
                        </div>
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
                ({filteredImages.length}
                {photoroomFilter !== "all" || birefnetFilter !== "all" ? ` of ${images.length}` : ""} images)
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

      {/* Modal */}
      {modal && (
        <dialog
          open
          aria-modal="true"
          aria-label={modal.alt}
          className="fixed inset-0 w-full h-full bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6 border-0"
          onKeyDown={(e) => e.key === "Escape" && closeModal()}
        >
          <button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 w-full h-full cursor-default"
            onClick={closeModal}
          />
          <div className="relative rounded-2xl shadow-2xl p-4 max-w-4xl max-h-full z-10">
            <button
              type="button"
              onClick={closeModal}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white border border-slate-200 shadow-md text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors flex items-center justify-center text-sm font-bold"
            >
              ✕
            </button>
            {/* biome-ignore lint/performance/noImgElement: modal needs unrestricted sizing */}
            <img
              src={modal.src}
              alt={modal.alt}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            <p className="text-xs text-slate-400 mt-2 text-center font-mono truncate">
              {modal.alt}
            </p>
          </div>
        </dialog>
      )}
    </>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const { default: images } = await import("@/data/images.json");
  return { props: { images: images as ImageData[] } };
};
