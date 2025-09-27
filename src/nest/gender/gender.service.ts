import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class GenderService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllGenders() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM "gender" ORDER BY id ASC'
    )
    return rows
  }
}
