import prisma from '@/lib/prisma'

export interface Gender {
  id: bigint
  gender: string
  created_at: Date
  updated_at: Date | null
}

export class GenderService {
  async getAllGenders(): Promise<Gender[]> {
    return await prisma.gender.findMany()
  }
}