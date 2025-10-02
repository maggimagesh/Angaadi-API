import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Seed age groups based on the screenshot
  const ageGroups = [
    { ageRange: '18-20', minAge: 18, maxAge: 20 },
    { ageRange: '21-24', minAge: 21, maxAge: 24 },
    { ageRange: '25-29', minAge: 25, maxAge: 29 },
    { ageRange: '30-34', minAge: 30, maxAge: 34 },
    { ageRange: '35-39', minAge: 35, maxAge: 39 },
    { ageRange: '40-44', minAge: 40, maxAge: 44 },
    { ageRange: '45-49', minAge: 45, maxAge: 49 },
    { ageRange: '50-54', minAge: 50, maxAge: 54 },
    { ageRange: '55-59', minAge: 55, maxAge: 59 },
    { ageRange: '60-64', minAge: 60, maxAge: 64 },
    { ageRange: '65+', minAge: 65, maxAge: null },
  ]

  for (const ageGroup of ageGroups) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).ageGroup.upsert({
      where: { ageRange: ageGroup.ageRange },
      update: {
        minAge: ageGroup.minAge,
        maxAge: ageGroup.maxAge,
      },
      create: {
        ageRange: ageGroup.ageRange,
        minAge: ageGroup.minAge,
        maxAge: ageGroup.maxAge,
      },
    })
    console.log(`✓ Created/Updated age group: ${ageGroup.ageRange}`)
  }

  console.log('✅ Seeding completed!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })

