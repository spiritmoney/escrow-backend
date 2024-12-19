import { Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { NotificationsService } from '../services/notifications.service';
import { NotificationResponse } from '../dto/notification.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiResponse({
    status: 200,
    description: 'List of notifications retrieved successfully',
    schema: {
      example: {
        notifications: [
          {
            id: 'notif_123',
            type: 'PAYMENT_RECEIVED',
            title: 'New payment received',
            message: 'You have received a new payment of $100',
            read: false,
            createdAt: '2024-03-21T10:00:00Z'
          }
        ],
        unreadCount: 1
      }
    }
  })
  async getNotifications(@CurrentUser() user) {
    return this.notificationsService.getUserNotifications(user.id);
  }

  @Put('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read',
    schema: {
      example: {
        message: 'All notifications marked as read'
      }
    }
  })
  async markAllAsRead(@CurrentUser() user) {
    return this.notificationsService.markAllAsRead(user.id);
  }
} 