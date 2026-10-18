"use client"

import { useAchievements } from "@/lib/hooks"
import { motion, AnimatePresence } from "framer-motion"
import * as Icons from "lucide-react"

export function AchievementStrip() {
  const { data: achievements, isLoading } = useAchievements()

  if (isLoading || !achievements || achievements.length === 0) {
    return null
  }

  // Get only awarded achievements
  const awarded = achievements.filter((a) => a.awardedAt)
  // Sort by awardedAt desc
  awarded.sort((a, b) => {
    return new Date(b.awardedAt?.toDate() || 0).getTime() - new Date(a.awardedAt?.toDate() || 0).getTime()
  })

  // Take latest 3
  const latest = awarded.slice(0, 3)

  if (latest.length === 0) {
    return null
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8 rounded-neo-md border-brutal bg-paper-2 p-6"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-2xl font-bold text-ink">Recent Wins</h2>
        <span className="text-sm font-semibold uppercase tracking-widest text-taupe">
          {awarded.length} / {achievements.length} UNLOCKED
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <AnimatePresence>
          {latest.map((ach) => {
            // dynamic icon rendering
            const Icon = (Icons as any)[ach.icon || "Trophy"] || Icons.Trophy
            return (
              <motion.div
                key={ach.id}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.02 }}
                className="flex items-start gap-4 rounded-neo border-brutal bg-white p-4 shadow-brutal-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-brutal bg-mustard">
                  <Icon size={20} className="text-ink" />
                </div>
                <div>
                  <h3 className="font-bold text-ink">{ach.title}</h3>
                  <p className="mt-1 text-xs text-taupe">{ach.description}</p>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </motion.section>
  )
}
