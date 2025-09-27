import { Module } from '@nestjs/common'
import { PreferredDepartmentService } from './preferred-department.service'
import { PreferredDepartmentController } from './preferred-department.controller'

@Module({
  controllers: [PreferredDepartmentController],
  providers: [PreferredDepartmentService],
})
export class PreferredDepartmentModule {}
