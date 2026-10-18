"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, Brain, Check, CircleHelp, FileUp, IndianRupee, PiggyBank, ReceiptText, Shield, WalletCards } from "lucide-react";

import styles from "./landing-experience.module.css";

const rupees = (value: number) => `${value < 0 ? "− " : ""}₹${Math.abs(value).toLocaleString("en-IN")}`;

const journey = [
  {
    title: "Bring your records together",
    body: "Import a statement, review the preview, and choose which rows to add. Records without an account stay visible until you assign them.",
    icon: FileUp,
  },
  {
    title: "Make the month legible",
    body: "Add regular income and bills, assign the accounts that pay them, and mark a bill paid when you have handled it.",
    icon: WalletCards,
  },
  {
    title: "Choose what to protect",
    body: "Set a payday, a minimum reserve, and a goal contribution. Review the assumptions before you use the plan.",
    icon: Shield,
  },
];

const features = [
  { title: "Activity", description: "Review imported transactions, search, filter, and assign them to accounts.", href: "/app/transactions", icon: FileUp },
  { title: "Budgets", description: "Set spending limits and check how the month is tracking.", href: "/app/budgets", icon: WalletCards },
  { title: "Goals", description: "Choose a goal and decide what to reserve for it.", href: "/app/goals", icon: PiggyBank },
  { title: "Receipts", description: "Keep receipt details and return reminders close to your records.", href: "/app/receipts", icon: ReceiptText },
  { title: "Marco, optional", description: "An optional place to ask questions. Your core planning tools work without AI.", href: "/app/marco", icon: Brain },
];

export function LandingExperience() {
  const root = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [cashInput, setCashInput] = useState("82000");
  const [billsInput, setBillsInput] = useState("29500");
  const [dailySpendInput, setDailySpendInput] = useState("20000");
  const [goalInput, setGoalInput] = useState("10000");
  const cash = Number(cashInput) || 0;
  const bills = Number(billsInput) || 0;
  const dailySpend = Number(dailySpendInput) || 0;
  const goal = Number(goalInput) || 0;
  const remaining = cash - bills - dailySpend - goal;
  const steps = [
    { label: "Current cash", title: "Start with cash on hand", amount: cash, detail: "Illustrative amount available now" },
    { label: "Bills", title: "Set aside recorded bills", amount: cash - bills, detail: "After the bills you entered" },
    { label: "Everyday", title: "Include everyday spending", amount: cash - bills - dailySpend, detail: "After your monthly spending estimate" },
    { label: "Goal", title: "Reserve for your goal", amount: remaining, detail: "After the goal reserve you entered" },
  ];
  const currentStep = steps[activeStep];

  useEffect(() => {
    if (!root.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const intro = gsap.timeline({ defaults: { ease: "power4.out" } });
      intro
        .fromTo("[data-hero-copy]", { y: 22, opacity: 0.55 }, { y: 0, opacity: 1, duration: 0.72 })
        .fromTo("[data-plan-art]", { y: 28, rotate: 1.2, opacity: 0.6 }, { y: 0, rotate: 0, opacity: 1, duration: 0.85 }, "-=0.52")
        .fromTo("[data-plan-rule]", { scaleX: 0.1, transformOrigin: "left center" }, { scaleX: 1, duration: 0.65 }, "-=0.52");
      return () => intro.kill();
    }, root.current);
    media.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
      const journey = root.current?.querySelector("[data-payday-journey]");
      const path = root.current?.querySelector<HTMLElement>("[data-journey-path]");
      const markers = root.current?.querySelectorAll<HTMLElement>("[data-journey-mark]");
      if (!journey || !path || !markers?.length) return;
      const sequence = gsap.timeline({
        scrollTrigger: { trigger: journey, start: "top 72%", end: "bottom 48%", scrub: 0.65 },
      });
      sequence.fromTo(path, { scaleX: 0 }, { scaleX: 1, ease: "none" }, 0);
      markers.forEach((marker, index) => {
        sequence.to(marker, { backgroundColor: "#f2d13f", color: "#171719", duration: 0.08 }, index * 0.3 + 0.05);
      });
      return () => { sequence.scrollTrigger?.kill(); sequence.kill(); };
    }, root.current);
    return () => media.revert();
  }, []);

  useEffect(() => {
    if (!root.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const amount = root.current.querySelector<HTMLElement>("[data-plan-amount]");
    if (!amount) return;
    const tween = gsap.fromTo(amount, { y: 7, opacity: 0.35 }, { y: 0, opacity: 1, duration: 0.28, ease: "power3.out" });
    return () => { tween.kill(); };
  }, [activeStep]);

  return (
    <div ref={root} className={styles.landing}>
      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={styles.heroCopy} data-hero-copy>
          <h1 id="landing-title">Make payday<br /><em>feel less far away.</em></h1>
          <p className={styles.lede}>
            Bring in statements and commitments. See what you can set aside and what remains for everyday spending.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href="/contact">Ask about pilot access <ArrowRight aria-hidden="true" size={17} /></Link>
            <Link className={styles.textButton} href="/auth/signin">Already invited? Sign in</Link>
          </div>
          <p className={styles.pilotLine}>Invite-only pilot · India</p>
          <p className={styles.honestyLine}>Manual statement imports · No bank connection · No payments or money movement</p>
        </div>

        <div className={styles.planStage} data-plan-art>
          <div className={styles.planMeta}>
            <span className={styles.sampleLabel}>Monthly example · INR</span>
          </div>
          <div className={styles.planPaper}>
            <div className={styles.paperTop}>
              <span>PAYDAY, IN FOUR STEPS</span>
              <span>EXAMPLE</span>
            </div>
            <div className={styles.planBalance} aria-live="polite" aria-atomic="true">
              <p>{currentStep.title}</p>
              <strong data-plan-amount><IndianRupee aria-hidden="true" size={28} strokeWidth={2.5} />{currentStep.amount.toLocaleString("en-IN")}</strong>
              <span>{currentStep.detail}</span>
            </div>
            <div className={styles.flowTrack} data-plan-rule style={{ background: `linear-gradient(to right, #f2d13f ${(activeStep / (steps.length - 1)) * 100}%, #d8cfbe ${(activeStep / (steps.length - 1)) * 100}%)` }} aria-hidden="true"><i style={{ left: `${(activeStep / (steps.length - 1)) * 100}%` }} /></div>
            <div className={styles.stepButtons} role="group" aria-label="Explore the illustrative payday plan">
              {steps.map((step, index) => (
                <button key={step.label} type="button" aria-pressed={activeStep === index} onClick={() => setActiveStep(index)}>
                  <span className={styles.stepDot}>{index < activeStep ? <Check size={13} aria-hidden="true" /> : `0${index + 1}`}</span>
                  <span>{step.label}</span>
                </button>
              ))}
            </div>
            <div className={styles.breakdown}>
              <label><span>Current cash</span><span className={styles.inputAmount}>₹<input aria-label="Example current cash in rupees" type="number" min="0" max="1000000" step="1000" inputMode="numeric" value={cashInput} onChange={(event) => setCashInput(event.target.value)} /></span></label>
              <label><span>Recorded bills</span><span className={styles.inputAmount}>− ₹<input aria-label="Example recorded bills in rupees" type="number" min="0" max="1000000" step="500" inputMode="numeric" value={billsInput} onChange={(event) => setBillsInput(event.target.value)} /></span></label>
              <label><span>Everyday spend / month</span><span className={styles.inputAmount}>− ₹<input aria-label="Example monthly everyday spending in rupees" type="number" min="0" max="1000000" step="1000" inputMode="numeric" value={dailySpendInput} onChange={(event) => setDailySpendInput(event.target.value)} /></span></label>
              <label><span>Goal reserve</span><span className={styles.inputAmount}>− ₹<input aria-label="Example goal reserve in rupees" type="number" min="0" max="1000000" step="500" inputMode="numeric" value={goalInput} onChange={(event) => setGoalInput(event.target.value)} /></span></label>
              <div className={styles.breakdownTotal} aria-live="polite"><span>{remaining < 0 ? "Shortfall in this example" : "Left after these entries"}</span><b>{rupees(remaining)}</b></div>
            </div>
          </div>
          <p className={styles.planNote}><CircleHelp size={15} aria-hidden="true" /> Example only. Everyday spending is your estimate, not verified transaction data.</p>
        </div>
      </section>

      <section className={styles.statement} aria-label="Product promise">
        <p>YOUR MONEY, IN CONTEXT.</p>
        <p>Not a live bank balance. <strong>A plan built from the information you provide.</strong></p>
      </section>

      <section id="how-it-works" data-payday-journey className={styles.journey} aria-labelledby="journey-title">
        <div className={styles.sectionIntro}>
          <h2 id="journey-title">From records to a payday plan.</h2>
        </div>
        <div className={styles.journeyTrack} aria-hidden="true">
          <i data-journey-path />
          {journey.map((item, index) => <span key={item.title} data-journey-mark>{`0${index + 1}`}</span>)}
        </div>
        <div className={styles.journeyRows}>
          {journey.map((item, index) => {
            const Icon = item.icon;
            return (
              <article className={styles.journeyRow} data-payday-beat={index} key={item.title}>
                <Icon className={styles.journeyIcon} size={24} strokeWidth={1.7} aria-hidden="true" />
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="features" className={styles.features} aria-labelledby="features-title">
        <div className={styles.featuresIntro}>
          <h2 id="features-title">Your month, with room to decide.</h2>
          <p>Use one tool or follow the full payday routine. Your records remain yours to review.</p>
        </div>
        <ul className={styles.featureList}>
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <li key={feature.title}>
                <Link href={feature.href}>
                  <Icon size={23} strokeWidth={1.7} aria-hidden="true" />
                  <span><strong>{feature.title}</strong><small>{feature.description}</small></span>
                  <ArrowRight className={styles.featureArrow} size={18} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.truth} aria-labelledby="truth-title">
        <div className={styles.truthMark} aria-hidden="true"><WalletCards size={44} strokeWidth={1.5} /></div>
        <div>
          <h2 id="truth-title">You stay in charge<br />of every decision.</h2>
          <p className={styles.sectionLabel}>Designed for real life, with clear limits</p>
          <p>Vasoli uses the accounts, statement rows, and regular commitments you enter. Forecasts can miss things you have not recorded. Review the inputs, confirm balances when they change, and decide what to do yourself.</p>
          <Link href="/about" className={styles.inlineLink}>What this pilot does <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>

      <section className={styles.lastWord}>
        <div>
          <h2>Give your next payday<br />a little more direction.</h2>
          <p>Vasoli is invite-only while the pilot takes shape.</p>
        </div>
        <div className={styles.lastActions}>
          <Link className={styles.primaryButton} href="/auth/signin">Sign in <ArrowRight aria-hidden="true" size={17} /></Link>
          <Link className={styles.textButton} href="/contact">Ask about access</Link>
        </div>
      </section>
    </div>
  );
}
