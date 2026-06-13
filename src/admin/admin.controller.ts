import { Controller, Post, Get, Patch, Body, Query, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth, ApiOkResponse, ApiUnauthorizedResponse, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminJwtGuard } from './admin-jwt.guard';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { AdminTicketsQueryDto } from './dto/admin-tickets-query.dto';

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
  @Get('tickets')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all support tickets', description: 'Returns paginated support tickets with user info and images. Optionally filter by status or issue type.' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'status', required: false, type: String, example: 'open' })
  @ApiQuery({ name: 'issueType', required: false, type: String, example: 'bug' })
  @ApiOkResponse({ description: 'Paginated tickets list' })
  getTickets(@Query() query: AdminTicketsQueryDto) {
    return this.adminService.getTickets(query);
  }

  @UseGuards(AdminJwtGuard)
  @Patch('tickets/:id/resolve')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resolve a support ticket', description: 'Marks a support ticket as resolved.' })
  @ApiOkResponse({ description: 'Ticket resolved' })
  resolveTicket(@Param('id') id: string) {
    return this.adminService.resolveTicket(id);
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
  @ApiQuery({ name: 'date', required: false, type: String, example: '2024-01-15', description: 'Filter users who opened the app on this date (YYYY-MM-DD)' })
  @ApiOkResponse({ description: 'Paginated users list' })
  getUsers(@Query() query: AdminUsersQueryDto) {
    return this.adminService.getUsers(query);
  }
}
