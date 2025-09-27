import { IsEmail, IsNotEmpty, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateUserDto {
  @ApiProperty({ example: 'John' })
  @IsNotEmpty()
  firstName!: string

  @ApiProperty({ example: 'Doe' })
  @IsNotEmpty()
  lastName!: string

  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  emailId!: string

  @ApiProperty({ example: 'Password123' })
  @MinLength(8)
  password!: string
}


export class SignInDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  emailId!: string

  @ApiProperty({ example: 'Password123' })
  @MinLength(8)
  password!: string
}


