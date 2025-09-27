import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './nest/app.module'
import cors from 'cors'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false })
  app.use(
    cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' })
  )

  const port = Number(process.env.PORT || 3300)
  await app.listen(port)
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}/api/v1`)
}

bootstrap()


