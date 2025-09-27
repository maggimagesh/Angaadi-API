import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './nest/app.module'
import cors from 'cors'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { BigIntSerializerInterceptor } from './nest/common/interceptors/bigint-serializer.interceptor'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false })
  app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }))
  app.setGlobalPrefix('api/v1')
  app.useGlobalInterceptors(new BigIntSerializerInterceptor())

  const swaggerConfig = new DocumentBuilder()
    .setTitle('E-commerce API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build()
  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('/api/v1', app, document)

  const port = Number(process.env.PORT || 3300)
  await app.listen(port)
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}/api/v1`)
}

bootstrap()


