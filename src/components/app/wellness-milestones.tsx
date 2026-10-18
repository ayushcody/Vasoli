"use client"

import { useAchievements } from "@/lib/hooks"
import { motion } from "framer-motion"
import * as Icons from "lucide-react"

export function WellnessMilestones() {
  const { data: achievements, isLoading } = useAchievements()

  if (isLoading || !achievements) {
    return (
      <div className="rounded-neo-md border-brutal bg-paper-1 p-6 text-center">
        <p className="font-semibold text-taupe">Loading milestones...</p>
      </div>
    )
  }

  const awardedCount = achievements.filter((a) => a.awardedAt).length

  return (
    <section className="rounded-neo-md border-brutal-thick bg-paper-2 p-6 shadow-brutal">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-ink">Wellness Milestones</h2>
          <p className="text-sm text-taupe">Track your progress building healthy financial habits.</p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-2xl font-bold text-ink">{awardedCount} / {achievements.length}</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-taupe">Unlocked</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {achievements.map((ach) => {
          const isAwarded = !!ach.awardedAt
          const Icon = (Icons as any)[ach.icon || "Trophy"] || Icons.Trophy

          return (
            <motion.div
              key={ach.id}
              whileHover={{ scale: isAwarded ? 1.02 : 1 }}
              className={`flex items-start gap-4 rounded-neo border-brutal p-4 transition-colors ${
                isAwarded ? "bg-white shadow-brutal-sm" : "bg-paper-1 opacity-70 grayscale"
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-brutal ${
                  isAwarded ? "bg-mustard text-ink" : "bg-paper-2 text-taupe"
                }`}
              >
                <Icon size={20} />
              </div>
              <div>
                <h3 className={`font-bold ${isAwarded ? "text-ink" : "text-taupe"}`}>
                  {ach.title}
                </h3>
                <p className="mt-1 text-xs text-taupe">{ach.description}</p>
                {isAwarded && ach.awardedAt && (
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-green-700">
                    Unlocked
                  </p>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
