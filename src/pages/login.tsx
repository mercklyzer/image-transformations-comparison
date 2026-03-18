import { createHmac } from "node:crypto";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";

export default function Login() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setLoading(false);

    if (res.ok) {
      router.replace("/");
    } else {
      setError("Incorrect password. Please try again.");
      setPassword("");
    }
  }

  return (
    <>
      <Head>
        <title>Sign In — Image Comparison</title>
      </Head>

      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">
              Image Comparison
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Enter the password to continue
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-violet-50 border border-violet-200 rounded-2xl shadow-sm p-8 space-y-5"
          >
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-violet-500 uppercase tracking-wider mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••••"
                className="w-full px-4 py-2.5 rounded-lg border border-violet-200 bg-white text-slate-800 placeholder-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent transition"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-2.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const token = ctx.req.cookies.auth_token;
  if (token) {
    const expected = createHmac("sha256", process.env.AUTH_SECRET ?? "")
      .update("authenticated")
      .digest("hex");
    if (token === expected) {
      return { redirect: { destination: "/", permanent: false } };
    }
  }
  return { props: {} };
};
