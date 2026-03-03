"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { LogIn, ArrowLeft } from "lucide-react"

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Invalid email or password");
      } else {
        router.push("/dashboard")
        router.refresh()
      }
    } catch (error) {
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    setLoading(true)
    setError("")
    
    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "demo@vasoli.com", password: "demo123" }),
      });
      
      if (!response.ok) {
        setError("Demo login failed. Please configure Supabase DB demo user.");
      } else {
        router.push("/dashboard")
        router.refresh()
      }
    } catch {
       setError("Demo login failed. Please try manually.")
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper-1 p-4">
      <div className="w-full max-w-md space-y-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-taupe hover:text-ink transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
        <div className="border-brutal-thick rounded-neo-lg bg-paper-2 overflow-hidden shadow-brutal">
          <div className="bg-mustard border-b-brutal px-8 py-6 text-center">
            <Link href="/" className="inline-block mb-2">
              <Image src="/vasoli_logo.png" alt="Vasoli" width={160} height={50} className="h-10 w-auto object-contain mx-auto" draggable={false} />
            </Link>
            <p className="text-sm text-ink/70">Sign in to manage your finances</p>
          </div>
          <div className="p-8 space-y-6">
            {error && <div className="border-brutal rounded-neo bg-danger/10 text-danger px-4 py-3 text-sm font-medium">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-xs uppercase tracking-wide font-medium text-taupe">Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="w-full px-4 py-3 border-brutal rounded-neo bg-paper-1 text-sm focus:outline-none focus:shadow-brutal-sm transition-shadow" />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-xs uppercase tracking-wide font-medium text-taupe">Password</label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="w-full px-4 py-3 border-brutal rounded-neo bg-paper-1 text-sm focus:outline-none focus:shadow-brutal-sm transition-shadow" />
              </div>
              <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-neo border-brutal bg-cta text-ink font-bold text-sm hover:shadow-brutal transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? "Signing in..." : <>Sign In <LogIn className="h-4 w-4" /></>}
              </button>
            </form>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-ink/15" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-paper-2 px-3 text-taupe uppercase tracking-wide">or</span></div>
            </div>
            <button onClick={handleDemoLogin} disabled={loading} className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-neo border-brutal bg-paper-1 text-ink font-medium text-sm hover:shadow-brutal-sm transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50">
              🚀 Try Demo Account
            </button>
            <p className="text-center text-xs text-taupe">
              Don&apos;t have an account? <Link href="/auth/signup" className="text-cta font-medium hover:underline">Sign up free</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
