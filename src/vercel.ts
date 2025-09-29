import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './nest/app.module'
import { ExpressAdapter } from '@nestjs/platform-express'
import express, { Request, Response } from 'express'
import serverlessHttp from 'serverless-http'
import cors from 'cors'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { BigIntSerializerInterceptor } from './nest/common/interceptors/bigint-serializer.interceptor'

let cachedServer: any

async function bootstrapServer() {
  if (cachedServer) {
    return cachedServer
  }

  try {
    const expressInstance = express()
    
    // Add a simple health check route before initializing the full app
    expressInstance.use('/health', (req, res) => {
      res.status(200).json({ status: 'OK', message: 'Serverless function is running' })
    })

    const app = await NestFactory.create(AppModule, new ExpressAdapter(expressInstance), { cors: false })

    app.use(cors({ 
      origin: [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'https://angaadi-ui.vercel.app',
        'https://angaadi.vercel.app',
        'https://angaadi-frontend.vercel.app',
        'http://localhost:3000',
        'http://localhost:3001'
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
      optionsSuccessStatus: 200
    }))
    app.setGlobalPrefix('api/v1')
    app.useGlobalInterceptors(new BigIntSerializerInterceptor())

    // Setup Swagger for API documentation
    const swaggerConfig = new DocumentBuilder()
      .setTitle('E-commerce API')
      .setDescription('API documentation')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .build()
    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('docs', app, document)

    await app.init()

    cachedServer = serverlessHttp(expressInstance, {
      binary: ['application/octet-stream', 'image/*'],
    })
    return cachedServer
  } catch (error) {
    console.error('Error during server bootstrap:', error)
    console.error('Stack:', error.stack)
    
    // In case of failure during bootstrap, return a server that handles errors gracefully
    const expressInstance = express()
    expressInstance.use((req, res) => {
      res.status(500).json({
        error: 'Server bootstrap failed',
        message: error.message,
        ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {})
      })
    })
    
    return serverlessHttp(expressInstance, {
      binary: ['application/octet-stream', 'image/*'],
    })
  }
}

export default async function handler(req: Request, res: Response) {
  const server = await bootstrapServer()
  return server(req, res)
}


