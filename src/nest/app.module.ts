import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { AppController } from './app.controller'
import { UserModule } from './user/user.module'
import { PrismaModule } from './prisma/prisma.module'
import { ConfigModule } from '@nestjs/config'
import { GenderModule } from './gender/gender.module'
import { PreferredDepartmentModule } from './preferred-department/preferred-department.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),
    PrismaModule,
    AuthModule,
    UserModule,
    GenderModule,
    PreferredDepartmentModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
