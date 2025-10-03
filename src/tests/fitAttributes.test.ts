import { FitAttributeService } from '@/services/fitAttributeService'
import prisma from '@/lib/prisma'

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    fitAttribute: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    userFitAttribute: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}))

describe('FitAttributeService', () => {
  let fitAttributeService: FitAttributeService
  const mockPrisma = prisma as jest.Mocked<typeof prisma>

  beforeEach(() => {
    fitAttributeService = new FitAttributeService()
    jest.clearAllMocks()
  })

  describe('getAllFitAttributes', () => {
    // Positive Test Cases
    it('should return all fit attributes when no category filter is provided', async () => {
      const mockAttributes = [
        {
          id: BigInt(1),
          name: 'Bust',
          category: 'womens',
          displayOrder: 1,
          created_at: new Date(),
          updated_at: null,
        },
        {
          id: BigInt(2),
          name: 'Chest',
          category: 'mens',
          displayOrder: 1,
          created_at: new Date(),
          updated_at: null,
        },
      ]

      mockPrisma.fitAttribute.findMany.mockResolvedValue(mockAttributes)

      const result = await fitAttributeService.getAllFitAttributes()

      expect(result).toEqual(mockAttributes)
      expect(mockPrisma.fitAttribute.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { displayOrder: 'asc' },
      })
    })

    it('should return only womens fit attributes when category is womens', async () => {
      const mockAttributes = [
        {
          id: BigInt(1),
          name: 'Bust',
          category: 'womens',
          displayOrder: 1,
          created_at: new Date(),
          updated_at: null,
        },
      ]

      mockPrisma.fitAttribute.findMany.mockResolvedValue(mockAttributes)

      const result = await fitAttributeService.getAllFitAttributes('womens')

      expect(result).toEqual(mockAttributes)
      expect(mockPrisma.fitAttribute.findMany).toHaveBeenCalledWith({
        where: { category: 'womens' },
        orderBy: { displayOrder: 'asc' },
      })
    })

    it('should return only mens fit attributes when category is mens', async () => {
      const mockAttributes = [
        {
          id: BigInt(1),
          name: 'Chest',
          category: 'mens',
          displayOrder: 1,
          created_at: new Date(),
          updated_at: null,
        },
      ]

      mockPrisma.fitAttribute.findMany.mockResolvedValue(mockAttributes)

      const result = await fitAttributeService.getAllFitAttributes('mens')

      expect(result).toEqual(mockAttributes)
      expect(mockPrisma.fitAttribute.findMany).toHaveBeenCalledWith({
        where: { category: 'mens' },
        orderBy: { displayOrder: 'asc' },
      })
    })

    // Edge Cases
    it('should return empty array when no fit attributes exist', async () => {
      mockPrisma.fitAttribute.findMany.mockResolvedValue([])

      const result = await fitAttributeService.getAllFitAttributes()

      expect(result).toEqual([])
    })

    it('should return attributes sorted by displayOrder', async () => {
      const mockAttributes = [
        {
          id: BigInt(1),
          name: 'Bust',
          category: 'womens',
          displayOrder: 1,
          created_at: new Date(),
          updated_at: null,
        },
        {
          id: BigInt(2),
          name: 'Waist',
          category: 'womens',
          displayOrder: 2,
          created_at: new Date(),
          updated_at: null,
        },
      ]

      mockPrisma.fitAttribute.findMany.mockResolvedValue(mockAttributes)

      const result = await fitAttributeService.getAllFitAttributes('womens')

      expect(result[0].displayOrder).toBeLessThanOrEqual(result[1].displayOrder!)
    })
  })

  describe('getFitAttributeById', () => {
    // Positive Test Cases
    it('should return a fit attribute by valid ID', async () => {
      const mockAttribute = {
        id: BigInt(1),
        name: 'Bust',
        category: 'womens',
        displayOrder: 1,
        created_at: new Date(),
        updated_at: null,
      }

      mockPrisma.fitAttribute.findUnique.mockResolvedValue(mockAttribute)

      const result = await fitAttributeService.getFitAttributeById('1')

      expect(result).toEqual(mockAttribute)
      expect(mockPrisma.fitAttribute.findUnique).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
      })
    })

    // Negative Test Cases
    it('should return null when fit attribute does not exist', async () => {
      mockPrisma.fitAttribute.findUnique.mockResolvedValue(null)

      const result = await fitAttributeService.getFitAttributeById('999')

      expect(result).toBeNull()
    })

    // Edge Cases
    it('should handle large ID numbers', async () => {
      const largeId = '9007199254740991' // Max safe integer
      mockPrisma.fitAttribute.findUnique.mockResolvedValue(null)

      const result = await fitAttributeService.getFitAttributeById(largeId)

      expect(mockPrisma.fitAttribute.findUnique).toHaveBeenCalledWith({
        where: { id: BigInt(largeId) },
      })
    })
  })

  describe('saveUserFitAttribute', () => {
    // Positive Test Cases
    it('should create a new user fit attribute when it does not exist', async () => {
      const mockFitAttribute = {
        id: BigInt(1),
        name: 'Bust',
        category: 'womens',
        displayOrder: 1,
        created_at: new Date(),
        updated_at: null,
      }

      const mockUserFitAttribute = {
        id: BigInt(1),
        userId: BigInt(15),
        fitAttributeId: BigInt(1),
        value: '34',
        isActive: 1,
        created_at: new Date(),
        updated_at: null,
        fitAttribute: mockFitAttribute,
      }

      mockPrisma.fitAttribute.findUnique.mockResolvedValue(mockFitAttribute)
      mockPrisma.userFitAttribute.findFirst.mockResolvedValue(null)
      mockPrisma.userFitAttribute.create.mockResolvedValue(mockUserFitAttribute)

      const result = await fitAttributeService.saveUserFitAttribute({
        userId: '15',
        fitAttributeId: '1',
        value: '34',
      })

      expect(result.value).toBe('34')
      expect(mockPrisma.userFitAttribute.create).toHaveBeenCalled()
    })

    it('should update existing user fit attribute when it already exists', async () => {
      const mockFitAttribute = {
        id: BigInt(1),
        name: 'Bust',
        category: 'womens',
        displayOrder: 1,
        created_at: new Date(),
        updated_at: null,
      }

      const existingAttribute = {
        id: BigInt(1),
        userId: BigInt(15),
        fitAttributeId: BigInt(1),
        value: '32',
        isActive: 1,
        created_at: new Date(),
        updated_at: null,
      }

      const updatedAttribute = {
        ...existingAttribute,
        value: '34',
        updated_at: new Date(),
        fitAttribute: mockFitAttribute,
      }

      mockPrisma.fitAttribute.findUnique.mockResolvedValue(mockFitAttribute)
      mockPrisma.userFitAttribute.findFirst.mockResolvedValue(existingAttribute)
      mockPrisma.userFitAttribute.update.mockResolvedValue(updatedAttribute)

      const result = await fitAttributeService.saveUserFitAttribute({
        userId: '15',
        fitAttributeId: '1',
        value: '34',
      })

      expect(result.value).toBe('34')
      expect(mockPrisma.userFitAttribute.update).toHaveBeenCalled()
      expect(mockPrisma.userFitAttribute.create).not.toHaveBeenCalled()
    })

    // Negative Test Cases
    it('should throw error when fit attribute does not exist', async () => {
      mockPrisma.fitAttribute.findUnique.mockResolvedValue(null)

      await expect(
        fitAttributeService.saveUserFitAttribute({
          userId: '15',
          fitAttributeId: '999',
          value: '34',
        })
      ).rejects.toThrow('Fit attribute not found')
    })

    // Edge Cases
    it('should handle empty string values', async () => {
      const mockFitAttribute = {
        id: BigInt(1),
        name: 'Bust',
        category: 'womens',
        displayOrder: 1,
        created_at: new Date(),
        updated_at: null,
      }

      mockPrisma.fitAttribute.findUnique.mockResolvedValue(mockFitAttribute)
      mockPrisma.userFitAttribute.findFirst.mockResolvedValue(null)
      mockPrisma.userFitAttribute.create.mockResolvedValue({
        id: BigInt(1),
        userId: BigInt(15),
        fitAttributeId: BigInt(1),
        value: '',
        isActive: 1,
        created_at: new Date(),
        updated_at: null,
        fitAttribute: mockFitAttribute,
      })

      const result = await fitAttributeService.saveUserFitAttribute({
        userId: '15',
        fitAttributeId: '1',
        value: '',
      })

      expect(result.value).toBe('')
    })

    it('should handle very long string values', async () => {
      const longValue = 'x'.repeat(1000)
      const mockFitAttribute = {
        id: BigInt(1),
        name: 'Bust',
        category: 'womens',
        displayOrder: 1,
        created_at: new Date(),
        updated_at: null,
      }

      mockPrisma.fitAttribute.findUnique.mockResolvedValue(mockFitAttribute)
      mockPrisma.userFitAttribute.findFirst.mockResolvedValue(null)
      mockPrisma.userFitAttribute.create.mockResolvedValue({
        id: BigInt(1),
        userId: BigInt(15),
        fitAttributeId: BigInt(1),
        value: longValue,
        isActive: 1,
        created_at: new Date(),
        updated_at: null,
        fitAttribute: mockFitAttribute,
      })

      const result = await fitAttributeService.saveUserFitAttribute({
        userId: '15',
        fitAttributeId: '1',
        value: longValue,
      })

      expect(result.value).toBe(longValue)
    })

    it('should handle special characters in value', async () => {
      const specialValue = '34" (測量)'
      const mockFitAttribute = {
        id: BigInt(1),
        name: 'Bust',
        category: 'womens',
        displayOrder: 1,
        created_at: new Date(),
        updated_at: null,
      }

      mockPrisma.fitAttribute.findUnique.mockResolvedValue(mockFitAttribute)
      mockPrisma.userFitAttribute.findFirst.mockResolvedValue(null)
      mockPrisma.userFitAttribute.create.mockResolvedValue({
        id: BigInt(1),
        userId: BigInt(15),
        fitAttributeId: BigInt(1),
        value: specialValue,
        isActive: 1,
        created_at: new Date(),
        updated_at: null,
        fitAttribute: mockFitAttribute,
      })

      const result = await fitAttributeService.saveUserFitAttribute({
        userId: '15',
        fitAttributeId: '1',
        value: specialValue,
      })

      expect(result.value).toBe(specialValue)
    })
  })

  describe('getUserFitAttributes', () => {
    // Positive Test Cases
    it('should return all active fit attributes for a user', async () => {
      const mockAttributes = [
        {
          id: BigInt(1),
          userId: BigInt(15),
          fitAttributeId: BigInt(1),
          value: '34',
          isActive: 1,
          created_at: new Date(),
          updated_at: null,
          fitAttribute: {
            id: BigInt(1),
            name: 'Bust',
            category: 'womens',
            displayOrder: 1,
            created_at: new Date(),
            updated_at: null,
          },
        },
        {
          id: BigInt(2),
          userId: BigInt(15),
          fitAttributeId: BigInt(2),
          value: '28',
          isActive: 1,
          created_at: new Date(),
          updated_at: null,
          fitAttribute: {
            id: BigInt(2),
            name: 'Waist',
            category: 'womens',
            displayOrder: 2,
            created_at: new Date(),
            updated_at: null,
          },
        },
      ]

      mockPrisma.userFitAttribute.findMany.mockResolvedValue(mockAttributes)

      const result = await fitAttributeService.getUserFitAttributes('15')

      expect(result).toHaveLength(2)
      expect(result[0].value).toBe('34')
      expect(result[1].value).toBe('28')
    })

    // Edge Cases
    it('should return empty array when user has no fit attributes', async () => {
      mockPrisma.userFitAttribute.findMany.mockResolvedValue([])

      const result = await fitAttributeService.getUserFitAttributes('15')

      expect(result).toEqual([])
    })

    it('should only return active attributes (isActive = 1)', async () => {
      const mockAttributes = [
        {
          id: BigInt(1),
          userId: BigInt(15),
          fitAttributeId: BigInt(1),
          value: '34',
          isActive: 1,
          created_at: new Date(),
          updated_at: null,
          fitAttribute: {
            id: BigInt(1),
            name: 'Bust',
            category: 'womens',
            displayOrder: 1,
            created_at: new Date(),
            updated_at: null,
          },
        },
      ]

      mockPrisma.userFitAttribute.findMany.mockResolvedValue(mockAttributes)

      const result = await fitAttributeService.getUserFitAttributes('15')

      expect(mockPrisma.userFitAttribute.findMany).toHaveBeenCalledWith({
        where: { userId: BigInt(15), isActive: 1 },
        include: { fitAttribute: true },
        orderBy: { fitAttribute: { displayOrder: 'asc' } },
      })
    })

    it('should handle user with no attributes gracefully', async () => {
      mockPrisma.userFitAttribute.findMany.mockResolvedValue([])

      const result = await fitAttributeService.getUserFitAttributes('999')

      expect(result).toEqual([])
    })
  })

  describe('deleteUserFitAttribute', () => {
    // Positive Test Cases
    it('should delete a specific user fit attribute', async () => {
      const existingAttribute = {
        id: BigInt(1),
        userId: BigInt(15),
        fitAttributeId: BigInt(1),
        value: '34',
        isActive: 1,
        created_at: new Date(),
        updated_at: null,
      }

      mockPrisma.userFitAttribute.findFirst.mockResolvedValue(existingAttribute)
      mockPrisma.userFitAttribute.update.mockResolvedValue({
        ...existingAttribute,
        isActive: 0,
      })

      await fitAttributeService.deleteUserFitAttribute('15', '1')

      expect(mockPrisma.userFitAttribute.update).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
        data: { isActive: 0, updated_at: expect.any(Date) },
      })
    })

    // Negative Test Cases
    it('should throw error when user fit attribute does not exist', async () => {
      mockPrisma.userFitAttribute.findFirst.mockResolvedValue(null)

      await expect(
        fitAttributeService.deleteUserFitAttribute('15', '999')
      ).rejects.toThrow('User fit attribute not found')
    })

    // Edge Cases
    it('should not delete already inactive attributes', async () => {
      mockPrisma.userFitAttribute.findFirst.mockResolvedValue(null)

      await expect(
        fitAttributeService.deleteUserFitAttribute('15', '1')
      ).rejects.toThrow('User fit attribute not found')
    })
  })

  describe('deleteAllUserFitAttributes', () => {
    // Positive Test Cases
    it('should delete all fit attributes for a user', async () => {
      mockPrisma.userFitAttribute.updateMany.mockResolvedValue({ count: 3 })

      await fitAttributeService.deleteAllUserFitAttributes('15')

      expect(mockPrisma.userFitAttribute.updateMany).toHaveBeenCalledWith({
        where: { userId: BigInt(15), isActive: 1 },
        data: { isActive: 0, updated_at: expect.any(Date) },
      })
    })

    // Edge Cases
    it('should handle users with no attributes gracefully', async () => {
      mockPrisma.userFitAttribute.updateMany.mockResolvedValue({ count: 0 })

      await fitAttributeService.deleteAllUserFitAttributes('999')

      expect(mockPrisma.userFitAttribute.updateMany).toHaveBeenCalled()
    })

    it('should only deactivate active attributes', async () => {
      mockPrisma.userFitAttribute.updateMany.mockResolvedValue({ count: 2 })

      await fitAttributeService.deleteAllUserFitAttributes('15')

      expect(mockPrisma.userFitAttribute.updateMany).toHaveBeenCalledWith({
        where: { userId: BigInt(15), isActive: 1 },
        data: expect.any(Object),
      })
    })
  })

  describe('batchSaveUserFitAttributes', () => {
    // Positive Test Cases
    it('should save multiple fit attributes for a user', async () => {
      const mockFitAttribute1 = {
        id: BigInt(1),
        name: 'Bust',
        category: 'womens',
        displayOrder: 1,
        created_at: new Date(),
        updated_at: null,
      }

      const mockFitAttribute2 = {
        id: BigInt(2),
        name: 'Waist',
        category: 'womens',
        displayOrder: 2,
        created_at: new Date(),
        updated_at: null,
      }

      mockPrisma.fitAttribute.findUnique
        .mockResolvedValueOnce(mockFitAttribute1)
        .mockResolvedValueOnce(mockFitAttribute2)
      
      mockPrisma.userFitAttribute.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
      
      mockPrisma.userFitAttribute.create
        .mockResolvedValueOnce({
          id: BigInt(1),
          userId: BigInt(15),
          fitAttributeId: BigInt(1),
          value: '34',
          isActive: 1,
          created_at: new Date(),
          updated_at: null,
          fitAttribute: mockFitAttribute1,
        })
        .mockResolvedValueOnce({
          id: BigInt(2),
          userId: BigInt(15),
          fitAttributeId: BigInt(2),
          value: '28',
          isActive: 1,
          created_at: new Date(),
          updated_at: null,
          fitAttribute: mockFitAttribute2,
        })

      const result = await fitAttributeService.batchSaveUserFitAttributes('15', [
        { fitAttributeId: '1', value: '34' },
        { fitAttributeId: '2', value: '28' },
      ])

      expect(result).toHaveLength(2)
      expect(result[0].value).toBe('34')
      expect(result[1].value).toBe('28')
    })

    // Edge Cases
    it('should handle empty array', async () => {
      const result = await fitAttributeService.batchSaveUserFitAttributes('15', [])

      expect(result).toEqual([])
    })

    it('should handle single attribute in batch', async () => {
      const mockFitAttribute = {
        id: BigInt(1),
        name: 'Bust',
        category: 'womens',
        displayOrder: 1,
        created_at: new Date(),
        updated_at: null,
      }

      mockPrisma.fitAttribute.findUnique.mockResolvedValue(mockFitAttribute)
      mockPrisma.userFitAttribute.findFirst.mockResolvedValue(null)
      mockPrisma.userFitAttribute.create.mockResolvedValue({
        id: BigInt(1),
        userId: BigInt(15),
        fitAttributeId: BigInt(1),
        value: '34',
        isActive: 1,
        created_at: new Date(),
        updated_at: null,
        fitAttribute: mockFitAttribute,
      })

      const result = await fitAttributeService.batchSaveUserFitAttributes('15', [
        { fitAttributeId: '1', value: '34' },
      ])

      expect(result).toHaveLength(1)
    })

    // Negative Test Cases
    it('should throw error if one of the fit attributes does not exist', async () => {
      mockPrisma.fitAttribute.findUnique.mockResolvedValue(null)

      await expect(
        fitAttributeService.batchSaveUserFitAttributes('15', [
          { fitAttributeId: '999', value: '34' },
        ])
      ).rejects.toThrow('Fit attribute not found')
    })
  })
})

