import { Controller, Post, Body, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth, ApiOkResponse, ApiNoContentResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { GoogleLoginDto } from './dto/google-login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RefreshResponseDto } from './dto/refresh-response.dto';
import { MeResponseDto } from './dto/me-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('google')
  @ApiOperation({ summary: 'Sign in with Google', description: 'Verify Google ID token and return access + refresh tokens' })
  @ApiBody({ type: GoogleLoginDto })
  @ApiOkResponse({ type: AuthResponseDto })
  async googleLogin(@Body() dto: GoogleLoginDto) {
    return this.authService.googleLogin(dto.idToken);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token', description: 'Exchange a valid refresh token for a new short-lived access token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({ type: RefreshResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid, expired, or revoked refresh token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout', description: 'Revoke refresh token to end the session' })
  @ApiBody({ type: LogoutDto })
  @ApiNoContentResponse({ description: 'Session revoked successfully' })
  async logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('otp/request')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Request OTP', description: 'Send a 6-digit OTP to the given email. Rate limited to 3 requests per 60 seconds.' })
  @ApiBody({ type: RequestOtpDto })
  @ApiNoContentResponse({ description: 'OTP sent successfully' })
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto.email);
  }

  @Post('otp/verify')
  @ApiOperation({ summary: 'Verify OTP', description: 'Validate OTP and return access + refresh tokens. Creates account if email is new.' })
  @ApiBody({ type: VerifyOtpDto })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired OTP' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.email, dto.otp);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user', description: 'Returns the authenticated user payload from the access token' })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getMe(@CurrentUser() user: any) {
    return user;
  }
}
