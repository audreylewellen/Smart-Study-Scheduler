"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${backendUrl}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Signup failed");
      }
      setSuccess("Signup successful. You can now log in.");
      setEmail("");
      setPassword("");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Signup failed");
      } else {
        setError("Signup failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div style={{ color: 'red', fontWeight: 'bold', fontSize: 32 }}>DEBUG SIGNUP PAGE</div>
      <style>{`
        .force-black { color: #000 !important; }
      `}</style>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <div className="bg-white/90 shadow-xl rounded-2xl p-10 w-full max-w-md flex flex-col items-center">
          <div className="mb-6 flex flex-col items-center">
            <span className="text-3xl font-extrabold text-indigo-700 mb-2">StudySync</span>
            <h1 className="text-2xl font-bold text-gray-900">Sign Up</h1>
          </div>
          <form onSubmit={handleSignup} className="w-full flex flex-col gap-4">
            <div>
              <label className="block mb-1 text-sm font-medium force-black" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-base"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium force-black" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-base"
                required
                autoComplete="new-password"
              />
            </div>
            {error && (
              <div className="text-red-600 text-sm text-center">{error}</div>
            )}
            {success && (
              <div className="text-green-600 text-sm text-center">{success}</div>
            )}
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold text-lg shadow hover:bg-indigo-700 transition"
              disabled={loading}
            >
              {loading ? "Signing up..." : "Sign Up"}
            </button>
          </form>
          <div className="mt-6 text-center text-sm force-black">
            Already have an account?{' '}
            <Link href="/login" className="text-indigo-600 font-semibold hover:underline">Login</Link>
          </div>
        </div>
      </div>
    </>
  );
} 