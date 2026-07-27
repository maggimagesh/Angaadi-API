import prisma from '@/lib/prisma'

export interface AddressInput {
  fullName: string
  phone: string
  line1: string
  line2?: string
  city: string
  state: string
  pincode: string
  country?: string
  isDefault?: boolean
}

export class AddressService {
  private toBigInt(id: string): bigint {
    try {
      return BigInt(id)
    } catch {
      throw new Error('Invalid user id')
    }
  }

  private validate(input: AddressInput) {
    if (!input.fullName?.trim()) throw new Error('Full name is required')
    if (!/^\+?[\d\s-]{10,15}$/.test(input.phone?.trim() || '')) throw new Error('Enter a valid phone number')
    if (!input.line1?.trim()) throw new Error('Address line 1 is required')
    if (!input.city?.trim()) throw new Error('City is required')
    if (!input.state?.trim()) throw new Error('State is required')
    if (!/^\d{6}$/.test(input.pincode?.trim() || '')) throw new Error('Pin code must be six digits')
  }

  async listAddresses(userIdStr: string) {
    const userId = this.toBigInt(userIdStr)
    return prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { created_at: 'desc' }],
    })
  }

  async getAddress(userIdStr: string, addressIdStr: string) {
    const userId = this.toBigInt(userIdStr)
    let addressId: bigint
    try {
      addressId = BigInt(addressIdStr)
    } catch {
      throw new Error('Invalid address id')
    }
    const address = await prisma.address.findFirst({ where: { id: addressId, userId } })
    if (!address) throw new Error('Address not found')
    return address
  }

  async createAddress(userIdStr: string, input: AddressInput) {
    const userId = this.toBigInt(userIdStr)
    this.validate(input)

    const existingCount = await prisma.address.count({ where: { userId } })
    const makeDefault = input.isDefault || existingCount === 0

    if (makeDefault) {
      await prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } })
    }

    return prisma.address.create({
      data: {
        userId,
        fullName: input.fullName.trim(),
        phone: input.phone.trim(),
        line1: input.line1.trim(),
        line2: input.line2?.trim() || null,
        city: input.city.trim(),
        state: input.state.trim(),
        pincode: input.pincode.trim(),
        country: input.country?.trim() || 'India',
        isDefault: makeDefault,
      },
    })
  }

  async updateAddress(userIdStr: string, addressIdStr: string, input: AddressInput) {
    const userId = this.toBigInt(userIdStr)
    this.validate(input)
    const existing = await this.getAddress(userIdStr, addressIdStr)

    if (input.isDefault && !existing.isDefault) {
      await prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } })
    }

    return prisma.address.update({
      where: { id: existing.id },
      data: {
        fullName: input.fullName.trim(),
        phone: input.phone.trim(),
        line1: input.line1.trim(),
        line2: input.line2?.trim() || null,
        city: input.city.trim(),
        state: input.state.trim(),
        pincode: input.pincode.trim(),
        country: input.country?.trim() || 'India',
        isDefault: input.isDefault ?? existing.isDefault,
        updated_at: new Date(),
      },
    })
  }

  async setDefault(userIdStr: string, addressIdStr: string) {
    const userId = this.toBigInt(userIdStr)
    const existing = await this.getAddress(userIdStr, addressIdStr)
    await prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } })
    return prisma.address.update({
      where: { id: existing.id },
      data: { isDefault: true, updated_at: new Date() },
    })
  }

  async deleteAddress(userIdStr: string, addressIdStr: string) {
    const userId = this.toBigInt(userIdStr)
    const existing = await this.getAddress(userIdStr, addressIdStr)
    await prisma.address.delete({ where: { id: existing.id } })

    if (existing.isDefault) {
      const next = await prisma.address.findFirst({ where: { userId }, orderBy: { created_at: 'desc' } })
      if (next) {
        await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } })
      }
    }

    return this.listAddresses(userIdStr)
  }
}
