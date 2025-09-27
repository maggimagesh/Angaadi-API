import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common'
import { ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { PreferredDepartmentService } from './preferred-department.service'
import { PreferredDepartmentDto } from './preferred-department.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@ApiTags('preferred-department')
@Controller('preferred-department')
export class PreferredDepartmentController {
  constructor(private readonly service: PreferredDepartmentService) {}

  // POST /api/v1/preferred-department
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Set preferred department by gender selection' })
  @ApiBody({
    type: PreferredDepartmentDto,
    examples: { example1: { value: { userId: 15, genderId: 2 } } },
  })
  @ApiOkResponse({ description: 'Stored preference', schema: { example: { preference: { id: 1, userId: 15, genderId: 2, isActive: 1 } } } })
  async create(@Body() body: PreferredDepartmentDto) {
    const preference = await this.service.createPreferredDepartment(body)
    return { preference }
  }

  // GET /api/v1/preferred-department/:userId
  @UseGuards(JwtAuthGuard)
  @Get(':userId')
  @ApiOperation({ summary: 'Fetch latest preferred department for a user' })
  @ApiParam({ name: 'userId', required: true, description: 'User id as BigInt string' })
  @ApiOkResponse({ description: 'Latest preference', schema: { example: { preference: { id: 1, userId: 15, genderId: 2, isActive: 1 } } } })
  async getLatest(@Param('userId') userId: string) {
    const preference = await this.service.getLatestPreferredDepartmentByUserId(
      userId
    )
    return { preference: preference ?? {} }
  }

  // PUT /api/v1/preferred-department/:userId
  @UseGuards(JwtAuthGuard)
  @Put(':userId')
  @ApiOperation({ summary: 'Deactivate active preferred department for a user' })
  @ApiParam({ name: 'userId', required: true, description: 'User id as BigInt string' })
  @ApiOkResponse({ description: 'Success message', schema: { example: { message: 'The gender has been removed successfully' } } })
  async deactivate(@Param('userId') userId: string) {
    await this.service.deactivateByUserId(userId)
    return { message: 'The gender has been removed successfully' }
  }
}
