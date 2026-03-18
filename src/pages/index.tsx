import type { GetStaticProps } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const PAGE_SIZE = 50;
const SOURCE_FOLDER = "v1773826389";
const PHOTOROOM_FOLDER = "v1773826372";

type ReviewStatus = "accepted" | "rejected";
type Reviews = Record<string, ReviewStatus>;

function cloudUrl(folder: string, filename: string) {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${folder}/${encodeURIComponent(filename)}`;
}

function sourceUrl(filename: string) {
  const base = filename.replace(/\.[^.]+$/, "");
  return cloudUrl(SOURCE_FOLDER, `${base}.jpg`);
}

function photoroomUrl(filename: string) {
  const base = filename.replace(/\.[^.]+$/, "");
  return cloudUrl(PHOTOROOM_FOLDER, `${base}.png`);
}

function photoroomFilename(filename: string) {
  return `${filename.replace(/\.[^.]+$/, "")}.png`;
}

interface Props {
  images: string[];
}

export default function Home({ images }: Props) {
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState<{ src: string; alt: string } | null>(null);
  const [reviews, setReviews] = useState<Reviews>({});

  const closeModal = () => setModal(null);

  useEffect(() => {
    fetch("/api/reviews")
      .then((r) => r.json())
      .then((data: Reviews) => setReviews(data));
  }, []);

  async function handleReview(pfn: string, status: ReviewStatus) {
    const current = reviews[pfn];
    const next = current === status ? null : status;

    // Optimistic update
    setReviews((prev) => {
      const updated = { ...prev };
      if (next === null) delete updated[pfn];
      else updated[pfn] = next;
      return updated;
    });

    await fetch(`/api/reviews/${encodeURIComponent(pfn)}`, {
      method: next === null ? "DELETE" : "POST",
      headers: next ? { "Content-Type": "application/json" } : {},
      body: next ? JSON.stringify({ status: next }) : undefined,
    });
  }

  const totalPages = Math.ceil(images.length / PAGE_SIZE);
  const pageImages = images.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
          <div className="rounded-xl border border-violet-200 bg-violet-50 shadow-sm overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-violet-100 border-b border-violet-200">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-violet-500 uppercase tracking-wider w-1/2">
                    Source
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-violet-500 uppercase tracking-wider w-1/2">
                    Photoroom
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-violet-100">
                {pageImages.map((filename) => {
                  const pfn = photoroomFilename(filename);
                  const status = reviews[pfn];
                  return (
                    <tr
                      key={filename}
                      className={`transition-colors duration-150 ${
                        status === "accepted"
                          ? "bg-emerald-50 hover:bg-emerald-100/70"
                          : status === "rejected"
                            ? "bg-red-50 hover:bg-red-100/70"
                            : "hover:bg-violet-200/60"
                      }`}
                    >
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            setModal({
                              src: sourceUrl(filename),
                              alt: `Source: ${filename}`,
                            })
                          }
                          className="group text-left w-full"
                        >
                          {/* biome-ignore lint/performance/noImgElement: Cloudinary CDN handles optimization */}
                          <img
                            src={sourceUrl(filename)}
                            alt={`Source: ${filename}`}
                            className="max-h-48 object-contain rounded-md transition-transform duration-150 group-hover:scale-[1.02] cursor-pointer"
                          />
                          <p className="text-xs text-slate-400 mt-2 truncate font-mono">
                            {filename}
                          </p>
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            setModal({
                              src: photoroomUrl(filename),
                              alt: `Photoroom: ${pfn}`,
                            })
                          }
                          className="group text-left w-full"
                        >
                          {/* biome-ignore lint/performance/noImgElement: Cloudinary CDN handles optimization */}
                          <img
                            src={photoroomUrl(filename)}
                            alt={`Photoroom: ${pfn}`}
                            className="max-h-48 object-contain rounded-md transition-transform duration-150 group-hover:scale-[1.02] cursor-pointer"
                          />
                          <p className="text-xs text-slate-400 mt-2 truncate font-mono">
                            {pfn}
                          </p>
                        </button>

                        {/* Review buttons */}
                        <div className="flex gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => handleReview(pfn, "accepted")}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                              status === "accepted"
                                ? "bg-emerald-500 text-white shadow-sm"
                                : "border border-slate-200 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50"
                            }`}
                          >
                            <span>✓</span> Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReview(pfn, "rejected")}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                              status === "rejected"
                                ? "bg-red-500 text-white shadow-sm"
                                : "border border-slate-200 text-slate-500 hover:border-red-400 hover:text-red-600 hover:bg-red-50"
                            }`}
                          >
                            <span>✕</span> Reject
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
  return { props: { images } };
};
