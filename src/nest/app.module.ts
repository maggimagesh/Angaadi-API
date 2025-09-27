import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { AppController } from './app.controller'
import { UserModule } from './user/user.module'
import { PrismaModule } from './prisma/prisma.module'

@Module({
  imports: [PrismaModule, AuthModule, UserModule],
  controllers: [AppController],
})
export class AppModule {}


