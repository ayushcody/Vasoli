"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, CheckCircle2 } from "lucide-react"

export default function VerifyOTPPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get("email") || ""

  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!email) {
      router.push("/auth/signup")
    }
  }, [email, router])

  const handleChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return
    
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    if (value !== "" && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && otp[index] === "" && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const token = otp.join("")
    
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Invalid verification code");
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper-1 p-4">
      <div className="w-full max-w-md space-y-6">
        <Link href="/auth/signup" className="inline-flex items-center gap-2 text-sm text-taupe hover:text-ink transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to signup
        </Link>
        <div className="border-brutal-thick rounded-neo-lg bg-paper-2 overflow-hidden shadow-brutal">
          <div className="bg-mustard border-b-brutal px-8 py-6 text-center">
            <Link href="/" className="inline-block mb-2">
              <Image src="/vasoli_logo.png" alt="Vasoli" width={160} height={50} className="h-10 w-auto object-contain mx-auto" draggable={false} />
            </Link>
            <p className="text-sm text-ink/70">Verify your email address</p>
          </div>
          <div className="p-8 space-y-6">
            {error && <div className="border-brutal rounded-neo bg-danger/10 text-danger px-4 py-3 text-sm font-medium">{error}</div>}
            
            <div className="text-center space-y-2">
              <p className="text-sm text-ink font-medium">We sent a code to:</p>
              <p className="text-sm text-taupe font-bold tracking-wide">{email}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex justify-between gap-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el }}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-12 h-14 text-center text-xl font-bold border-brutal rounded-neo bg-paper-1 focus:outline-none focus:shadow-brutal-sm transition-shadow"
                  />
                ))}
              </div>
              <button type="submit" disabled={loading || otp.join("").length !== 6} className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-neo border-brutal bg-cta text-ink font-bold text-sm hover:shadow-brutal transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? "Verifying..." : <>Verify Email <CheckCircle2 className="h-4 w-4" /></>}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
