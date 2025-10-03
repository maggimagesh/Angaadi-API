import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedFitAttributes() {
  console.log('🌱 Seeding fit attributes...')

  // Define fit attributes with their optional values
  const fitAttributes = [
    // Shoulders attributes (IDs 1-3)
    { id: 1, attributeName: 'Shoulders', optionValue: 'Narrow' },
    { id: 2, attributeName: 'Shoulders', optionValue: 'Average' },
    { id: 3, attributeName: 'Shoulders', optionValue: 'Wide' },
    
    // Waist attributes (IDs 4-6)
    { id: 4, attributeName: 'Waist', optionValue: 'Narrow' },
    { id: 5, attributeName: 'Waist', optionValue: 'Average' },
    { id: 6, attributeName: 'Waist', optionValue: 'Wide' },
    
    // Thighs/Legs attributes (IDs 7-9)
    { id: 7, attributeName: 'Thighs/Legs', optionValue: 'Narrow' },
    { id: 8, attributeName: 'Thighs/Legs', optionValue: 'Average' },
    { id: 9, attributeName: 'Thighs/Legs', optionValue: 'Wide' },
    
    // Hips attributes (IDs 10-12)
    { id: 10, attributeName: 'Hips', optionValue: 'Narrow' },
    { id: 11, attributeName: 'Hips', optionValue: 'Average' },
    { id: 12, attributeName: 'Hips', optionValue: 'Wide' },
  ]

  for (const attr of fitAttributes) {
    try {
      const existing = await prisma.fitAttribute.findUnique({
        where: { id: attr.id },
      })

      if (existing) {
        console.log(`⏭️  Fit attribute ID ${attr.id} '${attr.attributeName} - ${attr.optionValue}' already exists, skipping...`)
      } else {
        await prisma.fitAttribute.create({
          data: {
            id: attr.id,
            attributeName: attr.attributeName,
            optionValue: attr.optionValue,
          },
        })
        console.log(`✅ Created fit attribute: ${attr.attributeName} - ${attr.optionValue} (ID: ${attr.id})`)
      }
    } catch (error) {
      console.error(`❌ Error creating fit attribute '${attr.attributeName} - ${attr.optionValue}':`, error)
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
