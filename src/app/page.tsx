"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  ArrowRight,
  ShieldCheck,
  Smartphone,
  FileSpreadsheet,
  Lock,
  Eye,
  Trash2,
  ChevronDown,
  Sparkles,
  Target,
  AlertTriangle,
  FileText,
  Scan,
  QrCode,
  Receipt,
  Shield,
  Package
} from "lucide-react";

/* ──────────────────────────────────────────
   Reusable section wrapper with fade-in
   ────────────────────────────────────────── */
function Section({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.section
      ref={ref}
      id={id}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

/* ──────────────────────────────────────────
   FAQ Accordion Item
   ────────────────────────────────────────── */
function FAQItem({ q, a }: { q: string; a: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={ref}
      className="border-brutal rounded-neo bg-paper-2 group"
    >
      <summary className="px-6 py-5 cursor-pointer flex items-center justify-between text-ink font-medium text-sm select-none list-none">
        {q}
        <ChevronDown className="h-4 w-4 text-taupe transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-6 pb-5 text-sm text-taupe leading-relaxed">
        {a}
      </div>
    </details>
  );
}

/* ──────────────────────────────────────────
   LANDING PAGE
   ────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-paper-1 overflow-x-hidden">
      {/* ════════ NAVIGATION ════════ */}
      <nav className="border-b-brutal-thick bg-paper-2 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="shrink-0 flex items-center gap-2">
            <Image
              src="/vasoli_logo.png"
              alt="Vasoli"
              width={160}
              height={48}
              priority
              className="h-9 w-auto object-contain"
              draggable={false}
            />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/signin"
              className="text-sm font-medium text-ink hover:text-cta transition-colors hidden sm:block"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-neo border-brutal bg-cta text-ink font-semibold text-sm shadow-brutal-sm hover:shadow-brutal transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              Get Started <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ════════ HERO ════════ */}
      <section className="border-b-brutal">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.7
              }}
              className="space-y-7"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-neo border-brutal bg-mustard text-xs font-bold uppercase tracking-wide">
                🇮🇳 Privacy-first finance toolkit
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-[3.4rem] font-serif font-bold leading-[1.1] text-ink">
                Know what you can
                <br />
                <span className="text-cta">safely spend</span> today.
              </h1>

              <p className="text-base sm:text-lg text-taupe leading-relaxed max-w-lg">
                Vasoli is a privacy-first money toolkit for Indian students.
                Track UPI spends, plan around bills, and turn receipts into
                reminders—without messy spreadsheets.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-neo border-brutal-thick bg-cta text-ink font-bold text-base shadow-brutal hover:shadow-brutal-hover transition-all hover:-translate-y-1 active:translate-y-0"
                >
                  Get Started <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="#features"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-neo border-brutal bg-paper-2 text-ink font-medium text-base hover:shadow-brutal-sm transition-all hover:-translate-y-0.5"
                >
                  View Demo
                </Link>
              </div>

              <p className="text-xs text-taupe flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-teal" />
                Receipts are encrypted locally before they leave your device.
              </p>
            </motion.div>

            {/* Hero Visual — Live dashboard mockup */}
            <motion.div
              initial={{ opacity: 0, x: 30, rotate: 1 }}
              animate={{ opacity: 1, x: 0, rotate: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative hidden md:block"
            >
              <div className="border-brutal-thick rounded-neo-lg bg-paper-2 p-6 shadow-brutal space-y-4">
                <div className="h-10 bg-mustard border-brutal rounded-neo flex items-center justify-between px-4">
                  <span className="text-sm font-serif font-bold">Cashflow Radar</span>
                  <span className="text-xs border-brutal rounded-full px-2 py-0.5 bg-paper-1 font-medium">Today</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="border-brutal rounded-neo bg-paper-1 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-taupe">Safe to Spend</p>
                    <p className="text-lg font-bold font-serif text-teal">₹4,200</p>
                  </div>
                  <div className="border-brutal rounded-neo bg-paper-1 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-taupe">Gap Days</p>
                    <p className="text-lg font-bold font-serif text-cta">3</p>
                  </div>
                  <div className="border-brutal rounded-neo bg-paper-1 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-taupe">Confidence</p>
                    <p className="text-lg font-bold font-serif text-teal">High</p>
                  </div>
                </div>
                {/* Mini chart bars */}
                <div className="flex items-end gap-1 h-16 px-2">
                  {[60, 55, 52, 48, 45, 50, 55, 35, 30, 28, 25, 40, 50, 55].map((h, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-t-sm ${h < 35 ? "bg-danger/60" : "bg-cobalt/40"}`}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 border-brutal rounded-neo bg-paper-1 px-3 py-2">
                    <span className="text-base">🍛</span>
                    <span className="text-xs text-ink font-medium flex-1">Swiggy</span>
                    <span className="text-xs text-taupe border-brutal rounded-full px-2 py-0.5 bg-cobalt/10 text-cobalt">Imported</span>
                    <span className="text-xs font-bold tabular-nums">-₹249</span>
                  </div>
                  <div className="flex items-center gap-3 border-brutal rounded-neo bg-paper-1 px-3 py-2">
                    <span className="text-base">🚌</span>
                    <span className="text-xs text-ink font-medium flex-1">Ola Auto</span>
                    <span className="text-xs text-taupe border-brutal rounded-full px-2 py-0.5 bg-grape/10 text-grape">UPI</span>
                    <span className="text-xs font-bold tabular-nums">-₹89</span>
                  </div>
                </div>
              </div>
              <div className="absolute -top-3 -right-3 border-brutal rounded-neo bg-teal px-3 py-1.5 text-xs font-bold text-ink shadow-brutal-sm rotate-3">
                ₹4,200 safe today ✅
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ════════ THE 3 PROBLEMS ════════ */}
      <Section className="bg-ink text-paper-1 border-b-brutal">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-taupe mb-3">Sound familiar?</p>
            <h2 className="text-3xl md:text-4xl font-serif font-bold">
              Three problems every student faces
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                emoji: "😰",
                problem: "\"I don't know what's safe to spend.\"",
                desc: "You check your balance, guess at upcoming bills, and hope for the best. By the 20th, you're eating Maggi.",
              },
              {
                emoji: "😤",
                problem: "\"I don't trust finance apps when sync breaks.\"",
                desc: "Ghost charges appear. Totals don't add up. You can't tell what's real vs. pending vs. duplicate.",
              },
              {
                emoji: "😩",
                problem: "\"Receipts get lost, refunds expire, warranties vanish.\"",
                desc: "That ₹2,999 headphone broke within warranty? Good luck finding the receipt in your camera roll.",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="border border-paper-1/20 rounded-neo-md p-7 bg-ink hover:bg-ink/90 transition-colors"
              >
                <div className="text-4xl mb-4">{item.emoji}</div>
                <h3 className="font-serif text-lg font-bold text-cta mb-2">{item.problem}</h3>
                <p className="text-sm text-paper-1/70 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ════════ WHAT VASOLI DOES — 3 BIG CARDS ════════ */}
      <Section id="features" className="border-b-brutal">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-14 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-cta">What Vasoli does</p>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-ink">
              Spend with confidence, not anxiety.
            </h2>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Card 1: Cashflow Gap Radar */}
            <motion.div
              whileHover={{ y: -6, rotate: -0.5 }}
              className="border-brutal-thick rounded-neo-md bg-paper-2 p-8 shadow-brutal group"
            >
              <div className="w-14 h-14 rounded-neo border-brutal bg-cta flex items-center justify-center mb-5 group-hover:shadow-brutal-sm transition-shadow">
                <Target className="h-6 w-6 text-ink" />
              </div>
              <h3 className="font-serif text-xl font-bold text-ink mb-2">Cashflow Gap Radar</h3>
              <p className="text-sm text-taupe leading-relaxed mb-4">
                Vasoli shows what's safe today—based on your upcoming bills and your next cash-in.
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-ink">
                  <div className="h-1.5 w-1.5 rounded-full bg-teal" /> Safe-to-Spend Today
                </div>
                <div className="flex items-center gap-2 text-ink">
                  <div className="h-1.5 w-1.5 rounded-full bg-cta" /> Minimum Safe Balance
                </div>
                <div className="flex items-center gap-2 text-ink">
                  <div className="h-1.5 w-1.5 rounded-full bg-danger" /> Gap Days Visualization
                </div>
                <div className="flex items-center gap-2 text-ink">
                  <div className="h-1.5 w-1.5 rounded-full bg-cobalt" /> What-if Simulator
                </div>
              </div>
            </motion.div>

            {/* Card 2: Sync Confidence */}
            <motion.div
              whileHover={{ y: -6, rotate: 0.5 }}
              className="border-brutal-thick rounded-neo-md bg-paper-2 p-8 shadow-brutal group"
            >
              <div className="w-14 h-14 rounded-neo border-brutal bg-cobalt flex items-center justify-center mb-5 group-hover:shadow-brutal-sm transition-shadow">
                <ShieldCheck className="h-6 w-6 text-ink" />
              </div>
              <h3 className="font-serif text-xl font-bold text-ink mb-2">Sync Confidence</h3>
              <p className="text-sm text-taupe leading-relaxed mb-4">
                Every transaction shows where it came from. No ghost charges. No mystery totals.
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-ink">
                  <div className="h-1.5 w-1.5 rounded-full bg-cobalt" /> Provenance Tracking
                </div>
                <div className="flex items-center gap-2 text-ink">
                  <div className="h-1.5 w-1.5 rounded-full bg-mustard" /> Pending vs Posted
                </div>
                <div className="flex items-center gap-2 text-ink">
                  <div className="h-1.5 w-1.5 rounded-full bg-grape" /> Duplicate Detection
                </div>
                <div className="flex items-center gap-2 text-ink">
                  <div className="h-1.5 w-1.5 rounded-full bg-teal" /> Full Audit Trail
                </div>
              </div>
            </motion.div>

            {/* Card 3: Receipt Lifecycle Vault */}
            <motion.div
              whileHover={{ y: -6, rotate: -0.3 }}
              className="border-brutal-thick rounded-neo-md bg-paper-2 p-8 shadow-brutal group"
            >
              <div className="w-14 h-14 rounded-neo border-brutal bg-teal flex items-center justify-center mb-5 group-hover:shadow-brutal-sm transition-shadow">
                <Receipt className="h-6 w-6 text-ink" />
              </div>
              <h3 className="font-serif text-xl font-bold text-ink mb-2">Receipt Lifecycle Vault</h3>
              <p className="text-sm text-taupe leading-relaxed mb-4">
                Receipts aren't photos. They're return dates, warranty timers, and proof—organized.
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-ink">
                  <div className="h-1.5 w-1.5 rounded-full bg-cta" /> Return Window Alerts
                </div>
                <div className="flex items-center gap-2 text-ink">
                  <div className="h-1.5 w-1.5 rounded-full bg-cobalt" /> Warranty Reminders
                </div>
                <div className="flex items-center gap-2 text-ink">
                  <div className="h-1.5 w-1.5 rounded-full bg-grape" /> Auto-match to Transactions
                </div>
                <div className="flex items-center gap-2 text-ink">
                  <div className="h-1.5 w-1.5 rounded-full bg-teal" /> Export Bundles (CSV/PDF)
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </Section>

      {/* ════════ INDIA-FIRST ════════ */}
      <Section className="bg-mustard border-b-brutal">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-14 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-ink/50">Built for India 🇮🇳</p>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-ink">
              UPI-native by design
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <motion.div
              whileHover={{ y: -4 }}
              className="border-brutal-thick rounded-neo-md bg-paper-1 p-8 shadow-brutal"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-neo border-brutal bg-cobalt flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-ink" />
                </div>
                <h3 className="font-serif text-xl font-bold text-ink">Pay via UPI</h3>
              </div>
              <p className="text-sm text-taupe leading-relaxed mb-5">
                Initiate payments directly via Google Pay / UPI intent links.
                Every payment gets logged as a pending transaction with provenance.
              </p>
              <div className="flex gap-3">
                <div className="border-brutal rounded-neo bg-paper-2 px-4 py-2 text-xs font-bold text-ink flex items-center gap-2">
                  <QrCode className="h-4 w-4" /> QR Code
                </div>
                <div className="border-brutal rounded-neo bg-paper-2 px-4 py-2 text-xs font-bold text-ink flex items-center gap-2">
                  <Smartphone className="h-4 w-4" /> Google Pay
                </div>
                <div className="border-brutal rounded-neo bg-paper-2 px-4 py-2 text-xs font-bold text-ink flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" /> Deep Link
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ y: -4 }}
              className="border-brutal-thick rounded-neo-md bg-paper-1 p-8 shadow-brutal"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-neo border-brutal bg-teal flex items-center justify-center">
                  <FileSpreadsheet className="h-5 w-5 text-ink" />
                </div>
                <h3 className="font-serif text-xl font-bold text-ink">Statement Import</h3>
              </div>
              <p className="text-sm text-taupe leading-relaxed mb-5">
                Upload your HDFC or generic bank CSV statement.
                Vasoli normalizes merchant names, detects duplicates,
                and matches against pending UPI payments.
              </p>
              <div className="flex gap-3">
                <div className="border-brutal rounded-neo bg-paper-2 px-4 py-2 text-xs font-bold text-ink">
                  HDFC Bank
                </div>
                <div className="border-brutal rounded-neo bg-paper-2 px-4 py-2 text-xs font-bold text-ink">
                  Generic CSV
                </div>
                <div className="border-brutal rounded-neo bg-paper-2 px-4 py-2 text-xs font-bold text-ink">
                  Auto-dedup
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </Section>

      {/* ════════ PRIVACY-FIRST BY DESIGN ════════ */}
      <Section className="border-b-brutal">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-14 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-teal">Privacy-first</p>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-ink">
              Your money data never leaves your control.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Scan,
                title: "On-device OCR",
                desc: "Receipt scanning runs in your browser via Tesseract.js. Images are never uploaded to a server.",
                color: "bg-teal",
              },
              {
                icon: Lock,
                title: "Client-side Encryption",
                desc: "Receipt data is encrypted with your passphrase using AES-256-GCM before it ever leaves your device.",
                color: "bg-cobalt",
              },
              {
                icon: Trash2,
                title: "You Control Everything",
                desc: "Choose what's stored and what's deleted. Export or wipe your data anytime. No dark patterns.",
                color: "bg-cta",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                whileHover={{ y: -4 }}
                className="border-brutal-thick rounded-neo-md bg-paper-2 p-7 shadow-brutal text-center"
              >
                <div
                  className={`w-14 h-14 rounded-neo border-brutal ${item.color} flex items-center justify-center mx-auto mb-5`}
                >
                  <item.icon className="h-6 w-6 text-ink" />
                </div>
                <h3 className="font-serif text-lg font-bold text-ink mb-2">{item.title}</h3>
                <p className="text-sm text-taupe leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ════════ NEO-BRUTAL PAPER UI SHOWCASE ════════ */}
      <Section className="bg-paper-2 border-b-brutal">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-14 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-grape">The experience</p>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-ink">
              A calm, shame-free UI that feels like a personal finance zine.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Screenshot 1: Dashboard */}
            <motion.div
              whileHover={{ y: -6, rotate: -1 }}
              className="border-brutal-thick rounded-neo-md bg-paper-1 p-5 shadow-brutal"
            >
              <div className="h-8 bg-mustard border-brutal rounded-neo mb-3 flex items-center px-3">
                <span className="text-[10px] font-bold">Dashboard</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="border-brutal rounded-neo bg-paper-2 p-2">
                  <p className="text-[9px] text-taupe">Balance</p>
                  <p className="text-sm font-bold font-serif text-teal">₹12,400</p>
                </div>
                <div className="border-brutal rounded-neo bg-paper-2 p-2">
                  <p className="text-[9px] text-taupe">Spent</p>
                  <p className="text-sm font-bold font-serif text-cta">₹7,600</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[10px]">
                  <span>🍛</span> <span className="flex-1 text-taupe">Zomato</span>
                  <span className="font-bold">-₹320</span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span>🚌</span> <span className="flex-1 text-taupe">Metro Card</span>
                  <span className="font-bold">-₹200</span>
                </div>
              </div>
              <p className="text-center text-[9px] text-taupe mt-3 italic">Warm paper • Bold borders</p>
            </motion.div>

            {/* Screenshot 2: Receipt Vault */}
            <motion.div
              whileHover={{ y: -6, rotate: 0.5 }}
              className="border-brutal-thick rounded-neo-md bg-paper-1 p-5 shadow-brutal"
            >
              <div className="h-8 bg-teal border-brutal rounded-neo mb-3 flex items-center px-3">
                <span className="text-[10px] font-bold">Receipt Vault</span>
              </div>
              <div className="border-brutal rounded-neo bg-paper-2 p-3 mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">Amazon</span>
                  <span className="text-[9px] border-brutal rounded-full px-2 py-0.5 bg-grape/15 text-grape">Warranty</span>
                </div>
                <p className="text-sm font-bold font-serif">₹2,999</p>
                <p className="text-[9px] text-taupe flex items-center gap-1 mt-1">
                  <Shield className="h-2.5 w-2.5" /> Until 15 Mar 2027
                </p>
              </div>
              <div className="border-brutal rounded-neo bg-paper-2 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">Croma</span>
                  <span className="text-[9px] border-brutal rounded-full px-2 py-0.5 bg-cta/15 text-cta">Return</span>
                </div>
                <p className="text-sm font-bold font-serif">₹1,499</p>
                <p className="text-[9px] text-taupe flex items-center gap-1 mt-1">
                  <Package className="h-2.5 w-2.5" /> By 10 Mar 2026
                </p>
              </div>
              <p className="text-center text-[9px] text-taupe mt-3 italic">Encrypted • On-device</p>
            </motion.div>

            {/* Screenshot 3: Zine */}
            <motion.div
              whileHover={{ y: -6, rotate: -0.5 }}
              className="border-brutal-thick rounded-neo-md bg-paper-1 p-5 shadow-brutal"
            >
              <div className="h-8 bg-cta border-brutal rounded-neo mb-3 flex items-center px-3">
                <span className="text-[10px] font-bold">Ledger Zine — Feb 2026</span>
              </div>
              <div className="border-brutal rounded-neo bg-mustard/30 p-3 mb-2 text-center">
                <p className="text-[9px] text-taupe">You saved more! 🎉</p>
                <p className="text-lg font-bold font-serif text-teal">+₹2,400</p>
                <p className="text-[9px] text-taupe">vs last month</p>
              </div>
              <div className="border-brutal rounded-neo bg-paper-2 p-3">
                <p className="text-[9px] text-taupe mb-1">Top spending</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[10px]">
                    <span>🍛</span> <span className="flex-1">Food</span>
                    <div className="w-16 h-1.5 bg-paper-1 rounded-full overflow-hidden">
                      <div className="h-full bg-cta rounded-full" style={{ width: "70%" }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span>🚌</span> <span className="flex-1">Transport</span>
                    <div className="w-16 h-1.5 bg-paper-1 rounded-full overflow-hidden">
                      <div className="h-full bg-cobalt rounded-full" style={{ width: "40%" }} />
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-center text-[9px] text-taupe mt-3 italic">Shame-free • Deterministic</p>
            </motion.div>
          </div>
        </div>
      </Section>

      {/* ════════ FAQ ════════ */}
      <Section className="border-b-brutal">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <div className="text-center mb-12 space-y-3">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-ink">Questions?</h2>
          </div>
          <div className="space-y-3">
            <FAQItem
              q="Does Vasoli read my SMS?"
              a="No. Web apps can't access SMS on any platform. The only SMS-related feature on Android is OTP autofill, which is sandboxed and limited. Vasoli uses bank statement imports instead—reliable and transparent."
            />
            <FAQItem
              q="Is this a bank?"
              a="No. Vasoli is a tracker, planner, and receipt organiser. We don't hold money, offer loans, or provide financial advice. Think of it as a smart notebook for your money."
            />
            <FAQItem
              q="How do UPI transactions get added?"
              a="Two ways: (1) Import your bank statement CSV—Vasoli parses and normalises merchant names automatically. (2) Initiate UPI payments through Vasoli—they're logged as pending transactions and matched when you import your next statement."
            />
            <FAQItem
              q="Can I export my data?"
              a="Yes. You can export transactions as CSV, receipts as encrypted bundles, and your monthly Zine as a shareable summary. Your data is always yours."
            />
          </div>
        </div>
      </Section>

      {/* ════════ FINAL CTA ════════ */}
      <section className="bg-cta border-b-brutal">
        <div className="max-w-3xl mx-auto px-6 py-20 text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-4"
          >
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-ink leading-tight">
              Start with 2 minutes:<br />
              import a statement, see your safe-to-spend.
            </h2>
            <p className="text-base text-ink/70 max-w-lg mx-auto">
              No credit card. No app download. No dark patterns.
              Just clarity about your money.
            </p>
          </motion.div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center gap-2 px-10 py-4 rounded-neo border-brutal-thick bg-ink text-paper-1 font-bold text-lg shadow-brutal hover:shadow-brutal-hover transition-all hover:-translate-y-1 active:translate-y-0"
            >
              Get Started Free <Sparkles className="h-5 w-5" />
            </Link>
          </div>
          <p className="text-xs text-ink/50">
            Works on any device • Your data stays private • Free forever
          </p>
        </div>
      </section>

      {/* ════════ FOOTER ════════ */}
      <footer className="bg-paper-2">
        <div className="max-w-6xl mx-auto px-6 py-10">
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
              <span className="text-xs text-taupe">Privacy-first finance for Indian students</span>
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
  );
}
