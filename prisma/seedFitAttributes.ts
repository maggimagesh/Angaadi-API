import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedFitAttributes() {
  console.log('🌱 Seeding fit attributes...')

  // Women's fit attributes
  const womensFitAttributes = [
    { name: 'Bust', category: 'womens', displayOrder: 1 },
    { name: 'Waist', category: 'womens', displayOrder: 2 },
    { name: 'Hips', category: 'womens', displayOrder: 3 },
    { name: 'Inseam', category: 'womens', displayOrder: 4 },
    { name: 'Shoulder Width', category: 'womens', displayOrder: 5 },
    { name: 'Sleeve Length', category: 'womens', displayOrder: 6 },
    { name: 'Cup Size', category: 'womens', displayOrder: 7 },
    { name: 'Rise', category: 'womens', displayOrder: 8 },
    { name: 'Thigh', category: 'womens', displayOrder: 9 },
    { name: 'Neck', category: 'womens', displayOrder: 10 },
  ]

  // Men's fit attributes
  const mensFitAttributes = [
    { name: 'Chest', category: 'mens', displayOrder: 1 },
    { name: 'Waist', category: 'mens', displayOrder: 2 },
    { name: 'Inseam', category: 'mens', displayOrder: 3 },
    { name: 'Shoulder Width', category: 'mens', displayOrder: 4 },
    { name: 'Sleeve Length', category: 'mens', displayOrder: 5 },
    { name: 'Neck', category: 'mens', displayOrder: 6 },
    { name: 'Rise', category: 'mens', displayOrder: 7 },
    { name: 'Thigh', category: 'mens', displayOrder: 8 },
    { name: 'Hip', category: 'mens', displayOrder: 9 },
    { name: 'Outseam', category: 'mens', displayOrder: 10 },
  ]

  const allAttributes = [...womensFitAttributes, ...mensFitAttributes]

  for (const attr of allAttributes) {
    try {
      const existing = await prisma.fitAttribute.findUnique({
        where: { name: attr.name },
      })

      if (existing) {
        console.log(`⏭️  Fit attribute '${attr.name}' already exists, skipping...`)
      } else {
        await prisma.fitAttribute.create({
          data: attr,
        })
        console.log(`✅ Created fit attribute: ${attr.name} (${attr.category})`)
      }
    } catch (error) {
      console.error(`❌ Error creating fit attribute '${attr.name}':`, error)
    }
  }

  console.log('✨ Fit attributes seeding completed!')
}

async function main() {
  try {
    await seedFitAttributes()
  } catch (error) {
    console.error('❌ Error during seeding:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

