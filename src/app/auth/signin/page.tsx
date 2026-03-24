"use client";

import { createClient } from "@/lib/supabase/browser";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, LogIn, Loader2 } from "lucide-react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      // Check if backend is reachable before redirecting
      // This helps diagnose [Load failed] issues
      try {
        const healthRes = await fetch("/healthz");
        if (!healthRes.ok) {
           console.warn("[SignIn] Backend health check failed, but proceeding to dashboard...");
        }
      } catch (healthErr) {
        console.error("[SignIn] Backend unreachable:", healthErr);
        // We don't block login, but we log the issue
      }

      // Full page navigation to ensure cookies propagate and middleware runs
      window.location.href = "/app/dashboard";
    } catch (err) {
      console.error("[SignIn] Unexpected error:", err);
      setError("An unexpected error occurred. Please check your internet connection.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper-1 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl font-bold text-ink mb-2">Welcome back</h1>
          <p className="text-taupe">Sign in to your Vasoli account</p>
        </div>

        <form
          onSubmit={handleSignIn}
          className="border-brutal-thick rounded-neo-md bg-paper-2 p-8 shadow-brutal space-y-5"
        >
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="border-brutal rounded-neo bg-red-50 p-3 text-sm text-danger"
            >
              {error}
            </motion.div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-ink flex items-center gap-2">
              <Mail size={16} /> Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full border-brutal rounded-neo px-4 py-3 bg-paper-1 text-ink placeholder:text-taupe focus:outline-none focus:ring-2 focus:ring-ink transition-shadow"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-ink flex items-center gap-2">
              <Lock size={16} /> Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full border-brutal rounded-neo px-4 py-3 bg-paper-1 text-ink placeholder:text-taupe focus:outline-none focus:ring-2 focus:ring-ink transition-shadow"
            />
          </div>

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center justify-center gap-2 border-brutal-thick rounded-neo bg-cta text-ink font-semibold py-3 px-4 shadow-brutal-sm hover:shadow-brutal transition-all disabled:opacity-60"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            {loading ? "Signing in..." : "Sign In"}
          </motion.button>

          <p className="text-center text-sm text-taupe mt-4">
            Don't have an account?{" "}
            <Link href="/auth/signup" className="text-cobalt font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
