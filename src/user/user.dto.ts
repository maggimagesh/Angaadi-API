import { z } from 'zod'

export const CreateUserDto = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  emailId: z.string().email(),
  password: z.string().min(8),
})

export type CreateUserInput = z.infer<typeof CreateUserDto>


