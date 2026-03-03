"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { UserPlus, ArrowLeft } from "lucide-react"

export default function SignUpPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "An error occurred during signup");
      } else {
        router.push("/auth/verify?email=" + encodeURIComponent(email));
      }
    } catch (error) {
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
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
            <p className="text-sm text-ink/70">Create your account</p>
          </div>
          <div className="p-8 space-y-6">
            {error && <div className="border-brutal rounded-neo bg-danger/10 text-danger px-4 py-3 text-sm font-medium">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-xs uppercase tracking-wide font-medium text-taupe">Name</label>
                <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="John Doe" className="w-full px-4 py-3 border-brutal rounded-neo bg-paper-1 text-sm focus:outline-none focus:shadow-brutal-sm transition-shadow" />
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="text-xs uppercase tracking-wide font-medium text-taupe">Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="w-full px-4 py-3 border-brutal rounded-neo bg-paper-1 text-sm focus:outline-none focus:shadow-brutal-sm transition-shadow" />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-xs uppercase tracking-wide font-medium text-taupe">Password</label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="w-full px-4 py-3 border-brutal rounded-neo bg-paper-1 text-sm focus:outline-none focus:shadow-brutal-sm transition-shadow" />
              </div>
              <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-neo border-brutal bg-cta text-ink font-bold text-sm hover:shadow-brutal transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? "Creating account..." : <>Sign Up <UserPlus className="h-4 w-4" /></>}
              </button>
            </form>
            <p className="text-center text-xs text-taupe">
              Already have an account? <Link href="/auth/signin" className="text-cta font-medium hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
