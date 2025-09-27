import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  signToken(payload: Record<string, any>) {
    return this.jwtService.sign(payload)
  }
}


