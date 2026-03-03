import { createServerClient } from "@/lib/supabase"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import {
  Receipt,
  Target,
  Smartphone,
  Wallet,
  BarChart3,
  Bell,
  ArrowRight,
  IndianRupee,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  PiggyBank,
  CalendarCheck,
  Users
} from "lucide-react"

export default async function LandingPage() {
  const supabase = createServerClient(cookies())
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-paper-1">
      {/* Navigation */}
      <nav className="border-b-brutal-thick bg-paper-2">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="shrink-0">
            <Image
              src="/vasoli_logo.png"
              alt="Vasoli"
              width={200}
              height={64}
              className="h-12 w-auto object-contain"
              draggable={false}
            />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/auth/signin"
              className="text-sm font-medium text-ink hover:text-cta transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-neo border-brutal bg-cta text-ink font-medium text-sm hover:shadow-brutal transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              Start Free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="border-b-brutal">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-neo border-brutal bg-mustard text-xs font-medium uppercase tracking-wide">
                <IndianRupee className="h-3.5 w-3.5" />
                Made for India 🇮🇳
              </div>
              <h1 className="text-5xl md:text-6xl font-serif font-bold leading-tight">
                <span className="text-cta">वसूली</span> — Take Back Control of Your Money
              </h1>
              <p className="text-lg text-taupe leading-relaxed max-w-lg">
                Track every rupee you spend, set budgets that actually work,
                and achieve your savings goals. Built for Indian students,
                professionals, and families.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-neo border-brutal bg-cta text-ink font-bold text-base hover:shadow-brutal-hover transition-all hover:-translate-y-1 active:translate-y-0"
                >
                  Start Tracking Free <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="/auth/signin"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-neo border-brutal bg-paper-2 text-ink font-medium text-base hover:shadow-brutal transition-all hover:-translate-y-0.5"
                >
                  Sign In
                </Link>
              </div>
              <p className="text-xs text-taupe flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                No credit card required • 100% free to use
              </p>
            </div>

            {/* Hero Visual — Stylized Dashboard Preview */}
            <div className="relative hidden md:block">
              <div className="border-brutal-thick rounded-neo-lg bg-paper-2 p-6 shadow-brutal space-y-4">
                {/* Mini header */}
                <div className="h-10 bg-mustard border-brutal rounded-neo flex items-center px-4">
                  <span className="text-sm font-serif font-bold">Monthly Overview</span>
                </div>
                {/* Mini stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="border-brutal rounded-neo bg-paper-1 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-taupe">Income</p>
                    <p className="text-lg font-bold font-serif text-teal">₹25,000</p>
                  </div>
                  <div className="border-brutal rounded-neo bg-paper-1 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-taupe">Spent</p>
                    <p className="text-lg font-bold font-serif text-danger">₹18,400</p>
                  </div>
                  <div className="border-brutal rounded-neo bg-paper-1 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-taupe">Saved</p>
                    <p className="text-lg font-bold font-serif text-cta">₹6,600</p>
                  </div>
                </div>
                {/* Mini expense bars */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-16 text-taupe">Rent</span>
                    <div className="flex-1 bg-paper-1 border-brutal rounded-neo h-5 overflow-hidden">
                      <div className="h-full bg-cta rounded-l-neo" style={{ width: '45%' }} />
                    </div>
                    <span className="text-xs font-bold tabular-nums">₹8,000</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-16 text-taupe">Food</span>
                    <div className="flex-1 bg-paper-1 border-brutal rounded-neo h-5 overflow-hidden">
                      <div className="h-full bg-mustard rounded-l-neo" style={{ width: '28%' }} />
                    </div>
                    <span className="text-xs font-bold tabular-nums">₹5,000</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-16 text-taupe">Travel</span>
                    <div className="flex-1 bg-paper-1 border-brutal rounded-neo h-5 overflow-hidden">
                      <div className="h-full bg-teal rounded-l-neo" style={{ width: '17%' }} />
                    </div>
                    <span className="text-xs font-bold tabular-nums">₹3,000</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-16 text-taupe">Recharge</span>
                    <div className="flex-1 bg-paper-1 border-brutal rounded-neo h-5 overflow-hidden">
                      <div className="h-full bg-grape rounded-l-neo" style={{ width: '10%' }} />
                    </div>
                    <span className="text-xs font-bold tabular-nums">₹2,400</span>
                  </div>
                </div>
              </div>
              {/* Decorative floating badge */}
              <div className="absolute -top-4 -right-4 border-brutal rounded-neo bg-teal px-3 py-1.5 text-xs font-bold text-ink shadow-brutal-sm rotate-3">
                26% Saved! 🎉
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Indian Context Section */}
      <section className="bg-mustard border-b-brutal">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-3xl font-serif font-bold">₹500</p>
              <p className="text-xs text-ink/70 mt-1">Chai & Snacks Budget</p>
            </div>
            <div>
              <p className="text-3xl font-serif font-bold">₹5,000</p>
              <p className="text-xs text-ink/70 mt-1">Pocket Money Tracking</p>
            </div>
            <div>
              <p className="text-3xl font-serif font-bold">₹25K</p>
              <p className="text-xs text-ink/70 mt-1">First Salary? Track It</p>
            </div>
            <div>
              <p className="text-3xl font-serif font-bold">₹1L+</p>
              <p className="text-xs text-ink/70 mt-1">Family Budget Ready</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="border-b-brutal">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl font-serif font-bold">
              सही हिसाब, सही ज़िन्दगी
            </h2>
            <p className="text-taupe text-lg max-w-2xl mx-auto">
              Right accounts, right life. Whether you're tracking pocket money or
              managing a household — Vasoli keeps your finances in check.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="border-brutal rounded-neo-md bg-paper-2 p-6 hover:shadow-brutal transition-all hover:-translate-y-1 group">
              <div className="w-12 h-12 rounded-neo border-brutal bg-paper-1 flex items-center justify-center mb-4 group-hover:bg-mustard transition-colors">
                <Receipt className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-serif font-bold mb-2">Expense Tracking</h3>
              <p className="text-sm text-taupe leading-relaxed">
                Log every ₹10 chai to ₹10,000 EMI. Categorize
                spending into Food, Travel, Recharge, Shopping & more.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="border-brutal rounded-neo-md bg-paper-2 p-6 hover:shadow-brutal transition-all hover:-translate-y-1 group">
              <div className="w-12 h-12 rounded-neo border-brutal bg-paper-1 flex items-center justify-center mb-4 group-hover:bg-teal transition-colors">
                <Target className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-serif font-bold mb-2">Savings Goals</h3>
              <p className="text-sm text-taupe leading-relaxed">
                Save for Diwali shopping, a new bike, emergency fund,
                or that dream vacation to Goa. Track progress visually.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="border-brutal rounded-neo-md bg-paper-2 p-6 hover:shadow-brutal transition-all hover:-translate-y-1 group">
              <div className="w-12 h-12 rounded-neo border-brutal bg-paper-1 flex items-center justify-center mb-4 group-hover:bg-cta transition-colors">
                <Smartphone className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-serif font-bold mb-2">Built for India</h3>
              <p className="text-sm text-taupe leading-relaxed">
                Amounts in ₹, Indian number formatting (lakhs & crores),
                designed for UPI, NEFT & IMPS transactions.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="border-brutal rounded-neo-md bg-paper-2 p-6 hover:shadow-brutal transition-all hover:-translate-y-1 group">
              <div className="w-12 h-12 rounded-neo border-brutal bg-paper-1 flex items-center justify-center mb-4 group-hover:bg-mustard transition-colors">
                <Wallet className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-serif font-bold mb-2">Budget Management</h3>
              <p className="text-sm text-taupe leading-relaxed">
                Set monthly budgets for groceries (₹5,000),
                eating out (₹3,000), transport (₹2,000) and stay on track.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="border-brutal rounded-neo-md bg-paper-2 p-6 hover:shadow-brutal transition-all hover:-translate-y-1 group">
              <div className="w-12 h-12 rounded-neo border-brutal bg-paper-1 flex items-center justify-center mb-4 group-hover:bg-teal transition-colors">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-serif font-bold mb-2">Reports & Analytics</h3>
              <p className="text-sm text-taupe leading-relaxed">
                See where your money goes every month. Compare spending
                trends, find patterns, and make smarter decisions.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="border-brutal rounded-neo-md bg-paper-2 p-6 hover:shadow-brutal transition-all hover:-translate-y-1 group">
              <div className="w-12 h-12 rounded-neo border-brutal bg-paper-1 flex items-center justify-center mb-4 group-hover:bg-cta transition-colors">
                <Bell className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-serif font-bold mb-2">Smart Reminders</h3>
              <p className="text-sm text-taupe leading-relaxed">
                Never miss electricity bill, rent, EMI, or mobile
                recharge. Set reminders that actually help.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who is Vasoli for? */}
      <section className="bg-paper-2 border-b-brutal">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl font-serif font-bold">For Every Indian 🇮🇳</h2>
            <p className="text-taupe text-lg">Whether you earn ₹5,000 pocket money or ₹5,00,000 salary</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="border-brutal rounded-neo-md bg-paper-1 p-8 text-center space-y-4 hover:shadow-brutal transition-all">
              <div className="w-16 h-16 rounded-neo-md border-brutal bg-mustard flex items-center justify-center mx-auto">
                <PiggyBank className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-serif font-bold">Students</h3>
              <p className="text-sm text-taupe">
                Track pocket money, mess bills, book expenses,
                and hostel costs. Save for that new phone!
              </p>
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-neo border-brutal bg-paper-2 text-xs font-medium">
                ₹3,000 - ₹10,000/month
              </div>
            </div>

            <div className="border-brutal rounded-neo-md bg-paper-1 p-8 text-center space-y-4 hover:shadow-brutal transition-all">
              <div className="w-16 h-16 rounded-neo-md border-brutal bg-teal flex items-center justify-center mx-auto">
                <TrendingUp className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-serif font-bold">Young Professionals</h3>
              <p className="text-sm text-taupe">
                First salary? EMIs starting? Track rent, food,
                subscriptions and build your emergency fund.
              </p>
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-neo border-brutal bg-paper-2 text-xs font-medium">
                ₹15,000 - ₹50,000/month
              </div>
            </div>

            <div className="border-brutal rounded-neo-md bg-paper-1 p-8 text-center space-y-4 hover:shadow-brutal transition-all">
              <div className="w-16 h-16 rounded-neo-md border-brutal bg-cta flex items-center justify-center mx-auto">
                <Users className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-serif font-bold">Families</h3>
              <p className="text-sm text-taupe">
                Household budget, kids' school fees, grocery bills,
                festival shopping, and long-term savings goals.
              </p>
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-neo border-brutal bg-paper-2 text-xs font-medium">
                ₹50,000 - ₹2,00,000/month
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b-brutal">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl font-serif font-bold">Simple as UPI</h2>
            <p className="text-taupe text-lg">Three steps to financial clarity</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full border-brutal-thick bg-mustard flex items-center justify-center mx-auto text-2xl font-serif font-bold">
                1
              </div>
              <h3 className="text-lg font-serif font-bold">Set Your Income</h3>
              <p className="text-sm text-taupe">
                Enter your monthly salary, pocket money, or freelance income.
                Vasoli adapts to your earnings.
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full border-brutal-thick bg-cta flex items-center justify-center mx-auto text-2xl font-serif font-bold">
                2
              </div>
              <h3 className="text-lg font-serif font-bold">Track Expenses</h3>
              <p className="text-sm text-taupe">
                Log each expense — auto-categorized into food, travel,
                bills, shopping, recharge & more.
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full border-brutal-thick bg-teal flex items-center justify-center mx-auto text-2xl font-serif font-bold">
                3
              </div>
              <h3 className="text-lg font-serif font-bold">See the Picture</h3>
              <p className="text-sm text-taupe">
                Beautiful charts show where every rupee went.
                Set goals and watch your savings grow.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-mustard border-b-brutal">
        <div className="max-w-3xl mx-auto px-6 py-20 text-center space-y-8">
          <div className="space-y-4">
            <p className="text-sm font-medium uppercase tracking-wide text-ink/60">
              पैसों का हिसाब रखो
            </p>
            <h2 className="text-4xl md:text-5xl font-serif font-bold">
              Apna Paisa, Apna Hisaab
            </h2>
            <p className="text-lg text-ink/70 max-w-xl mx-auto">
              Join thousands of Indians who track every rupee with Vasoli.
              Free forever. No ads. No hidden charges.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center gap-2 px-10 py-4 rounded-neo border-brutal-thick bg-cta text-ink font-bold text-lg hover:shadow-brutal-hover transition-all hover:-translate-y-1 active:translate-y-0"
            >
              Start Tracking Free <Sparkles className="h-5 w-5" />
            </Link>
          </div>
          <p className="text-xs text-ink/50">
            Works on any device • No app download needed • Your data stays private
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-paper-2">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Image
                src="/vasoli_logo.png"
                alt="Vasoli"
                width={120}
                height={40}
                className="h-8 w-auto object-contain"
                draggable={false}
              />
              <span className="text-xs text-taupe">Smart Personal Finance for India</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-taupe">
              <Link href="/auth/signin" className="hover:text-ink transition-colors">Sign In</Link>
              <Link href="/auth/signup" className="hover:text-ink transition-colors">Sign Up</Link>
              <span className="text-xs">© 2026 Vasoli</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
