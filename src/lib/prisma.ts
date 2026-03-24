const missingPrismaMessage =
  "The legacy Prisma client import at '@/lib/prisma' is no longer configured in this codebase. Update the Marco tooling route to the current data layer before using it."

export const prisma = new Proxy(
  {},
  {
    get() {
      throw new Error(missingPrismaMessage)
    },
  },
) as any
