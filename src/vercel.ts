import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './nest/app.module'
import { ExpressAdapter } from '@nestjs/platform-express'
import express, { Request, Response } from 'express'
import serverlessHttp from 'serverless-http'
import cors from 'cors'

let cachedServer: any

async function bootstrapServer() {
  if (cachedServer) {
    return cachedServer
  }

  const expressInstance = express()
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressInstance), { cors: false })

  app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }))
  app.setGlobalPrefix('api/v1')

  await app.init()

  cachedServer = serverlessHttp(expressInstance)
  return cachedServer
}

export default async function handler(req: Request, res: Response) {
  const server = await bootstrapServer()
  return server(req, res)
}


