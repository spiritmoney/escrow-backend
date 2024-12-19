import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '../enums/notification.enum';

export class NotificationResponse {
  @ApiProperty({
    example: 'notif_123',
    description: 'Unique identifier for the notification'
  })
  id: string;

  @ApiProperty({
    enum: NotificationType,
    example: NotificationType.PAYMENT_RECEIVED,
    description: 'Type of notification'
  })
  type: NotificationType;

  @ApiProperty({
    example: 'New payment received',
    description: 'Notification title'
  })
  title: string;

  @ApiProperty({
    example: 'You have received a new payment of $100',
    description: 'Notification message'
  })
  message: string;

  @ApiProperty({
    example: false,
    description: 'Whether the notification has been read'
  })
  read: boolean;

  @ApiProperty({
    example: '2024-03-21T10:00:00Z',
    description: 'When the notification was created'
  })
  createdAt: Date;
} 