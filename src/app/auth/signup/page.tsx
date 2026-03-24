"use client";

import { createClient } from "@/lib/supabase/browser";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, UserPlus, Loader2, User, KeyRound } from "lucide-react";

type Step = "form" | "verify";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Step 1: Create account (sends OTP email)
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setStep("verify");
    setLoading(false);
  };

  // Step 2: Verify OTP code
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "signup",
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Full page navigation to ensure cookies propagate
    window.location.href = "/app/dashboard";
  };

  // Resend OTP
  const handleResend = async () => {
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    if (error) {
      setError(error.message);
    } else {
      setError(null);
    }
    setLoading(false);
  };

  // ─── OTP Verification Step ─────────────────────────────────
  if (step === "verify") {
    return (
      <div className="min-h-screen bg-paper-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">📬</div>
            <h2 className="font-serif text-2xl font-bold text-ink mb-2">
              Check your email
            </h2>
            <p className="text-taupe">
              We sent a 6-digit code to <strong className="text-ink">{email}</strong>
            </p>
          </div>

          <form
            onSubmit={handleVerifyOTP}
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
              <label htmlFor="otp" className="text-sm font-medium text-ink flex items-center gap-2">
                <KeyRound size={16} /> Verification Code
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                required
                placeholder="Enter 6-digit code"
                autoFocus
                className="w-full border-brutal rounded-neo px-4 py-3 bg-paper-1 text-ink text-center text-2xl font-bold tracking-[0.5em] placeholder:text-taupe placeholder:text-base placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-ink transition-shadow"
              />
            </div>

            <motion.button
              type="submit"
              disabled={loading || otp.length < 6}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 border-brutal-thick rounded-neo bg-cta text-ink font-semibold py-3 px-4 shadow-brutal-sm hover:shadow-brutal transition-all disabled:opacity-60"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
              {loading ? "Verifying..." : "Verify & Create Account"}
            </motion.button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="text-sm text-cobalt font-medium hover:underline disabled:opacity-50"
              >
                Didn't get the code? Resend
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  // ─── Sign-Up Form Step ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-paper-1 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl font-bold text-ink mb-2">Create Account</h1>
          <p className="text-taupe">Start taking control of your finances</p>
        </div>

        <form
          onSubmit={handleSignUp}
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
            <label htmlFor="name" className="text-sm font-medium text-ink flex items-center gap-2">
              <User size={16} /> Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full border-brutal rounded-neo px-4 py-3 bg-paper-1 text-ink placeholder:text-taupe focus:outline-none focus:ring-2 focus:ring-ink transition-shadow"
            />
          </div>

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
              minLength={6}
              placeholder="Min 6 characters"
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
            {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
            {loading ? "Sending code..." : "Create Account"}
          </motion.button>

          <p className="text-center text-sm text-taupe mt-4">
            Already have an account?{" "}
            <Link href="/auth/signin" className="text-cobalt font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
