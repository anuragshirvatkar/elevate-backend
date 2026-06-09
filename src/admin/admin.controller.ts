import { Controller, Post, Get, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth, ApiOkResponse, ApiUnauthorizedResponse, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminJwtGuard } from './admin-jwt.guard';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login', description: 'Authenticate as admin and receive a JWT access token' })
  @ApiBody({ type: AdminLoginDto })
  @ApiOkResponse({ description: 'Access token issued' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  login(@Body() dto: AdminLoginDto) {
    return this.adminService.login(dto.email, dto.password);
  }

  @UseGuards(AdminJwtGuard)
  @Get('users')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all users',
    description: 'Returns paginated list of users with companion, avatar, 7-day streak, 7-day activity record, and last login. Optionally filter by login date.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'date', required: false, type: String, example: '2024-01-15', description: 'Filter users who logged in on this date (YYYY-MM-DD)' })
  @ApiOkResponse({ description: 'Paginated users list' })
  getUsers(@Query() query: AdminUsersQueryDto) {
    return this.adminService.getUsers(query);
  }
}
