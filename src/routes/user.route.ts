import { Router } from 'express'
import { createUserController } from '../user/user.controller'

export const userRouter = Router()

userRouter.post('/', createUserController)
userRouter.post('/createUser', createUserController)


