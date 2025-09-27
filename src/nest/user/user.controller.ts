import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserService } from './user.service'
import { CreateUserDto, SignInDto } from './user.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  //POST /api/v1/createUser
  @Post('createUser')
  @ApiOperation({ summary: 'Create user' })
  @ApiBody({
    type: CreateUserDto,
    examples: {
      example1: {
        summary: 'Basic user',
        value: {
          firstName: 'John',
          lastName: 'Doe',
          emailId: 'john.doe@example.com',
          password: 'Password123',
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Created user', schema: { example: { user: { id: '1', created_at: '2025-09-27T12:34:56.789Z', firstName: 'John', lastName: 'Doe', emailId: 'john.doe@example.com' } } } })
  async createUserAlias(@Body() body: CreateUserDto) {
    const user = await this.userService.createUser(body)
    return { user }
  }

  // GET /api/v1/users
  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Fetch all users' })
  @ApiOkResponse({ description: 'List of users', schema: { example: { users: [ { id: '1', created_at: '2025-09-27T12:34:56.789Z', firstName: 'John', lastName: 'Doe', emailId: 'john.doe@example.com' } ] } } })
  async getAllUsers() {
    const users = await this.userService.getAllUsers()
    return { users }
  }

  // POST /api/v1/users/signIn
  @Post('signIn')
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiBody({
    type: SignInDto,
    examples: {
      example1: {
        summary: 'Valid credentials',
        value: { emailId: 'john.doe@example.com', password: 'Password123' },
      },
    },
  })
  @ApiOkResponse({ description: 'Signed-in user', schema: { example: { user: { id: '1', created_at: '2025-09-27T12:34:56.789Z', firstName: 'John', lastName: 'Doe', emailId: 'john.doe@example.com' }, token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...' } } })
  async signIn(@Body() body: SignInDto) {
    const result = await this.userService.signIn(body)
    return result
  }

  // POST /api/v1/users/signOut
  @Post('signOut')
  @ApiOperation({ summary: 'Sign out current session' })
  @ApiOkResponse({ description: 'Sign-out result', schema: { example: { message: 'Signed out successfully' } } })
  async signOut() {
    return { message: 'Signed out successfully' }
  }
}


