import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType } from '../enums/notification.enum';
import { systemResponses } from '../../contracts/system.responses';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async getUserNotifications(userId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Limit to most recent 50 notifications
    });

    const unreadCount = await this.prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });

    return {
      notifications,
      unreadCount,
    };
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
      },
    });

    return {
      message: systemResponses.EN.NOTIFICATIONS_MARKED_READ,
    };
  }

  async createNotification(userId: string, type: NotificationType, data: any) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title: this.getNotificationTitle(type),
        message: this.generateMessage(type, data),
        read: false,
      },
    });

    // Emit event for real-time updates
    this.eventEmitter.emit('notification.created', notification);

    return notification;
  }

  private getNotificationTitle(type: NotificationType): string {
    const titles = {
      [NotificationType.PAYMENT_RECEIVED]: 'New payment received',
      [NotificationType.KYC_APPROVED]: 'KYC verification approved',
      [NotificationType.NEW_FEATURE]: 'New feature available',
      // Add more notification types as needed
    };
    return titles[type] || 'New notification';
  }

  private generateMessage(type: NotificationType, data: any): string {
    switch (type) {
      case NotificationType.PAYMENT_RECEIVED:
        return `You have received a payment of ${data.amount} ${data.currency}`;
      case NotificationType.KYC_APPROVED:
        return 'Your KYC verification has been approved';
      case NotificationType.NEW_FEATURE:
        return `New feature available: ${data.featureName}`;
      default:
        return 'You have a new notification';
    }
  }
}
