import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { GenderService } from './gender.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@ApiTags('gender')
@Controller('gender')
export class GenderController {
  constructor(private readonly genderService: GenderService) {}

  // GET /api/v1/gender
  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Fetch all genders' })
  @ApiOkResponse({ description: 'List of genders', schema: { example: { genders: [ { id: 1, name: 'Male' }, { id: 2, name: 'Female' } ] } } })
  async getAll() {
    const genders = await this.genderService.getAllGenders()
    return { genders }
  }
}
