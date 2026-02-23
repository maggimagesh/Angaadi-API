import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

const prisma =
  global.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Limit connection pool to avoid exceeding Supabase session-mode max clients
    // @ts-ignore — Prisma accepts these via the connection string or constructor
  })

// Ensure only one instance during development hot reloads
if (process.env.NODE_ENV === 'development') global.prisma = prisma

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})

export default prisma