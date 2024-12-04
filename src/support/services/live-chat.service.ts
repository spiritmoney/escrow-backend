import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InitiateChatDto, ChatMessageDto } from '../dto/live-chat.dto';
import { systemResponses } from '../../contracts/system.responses';

@Injectable()
export class LiveChatService {
  constructor(private prisma: PrismaService) {}

  async initiateChat(userId: string, initiateChatDto: InitiateChatDto) {
    try {
      // Create chat session
      const session = await this.prisma.chatSession.create({
        data: {
          topic: initiateChatDto.topic,
          status: 'WAITING',
          user: {
            connect: { id: userId }
          },
          initialMessage: initiateChatDto.initialMessage
        }
      });

      // Simulate estimated wait time calculation
      const estimatedWaitTime = this.calculateEstimatedWaitTime();

      return {
        sessionId: session.id,
        status: session.status,
        createdAt: session.createdAt,
        estimatedWaitTime
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to initiate chat session'
      );
    }
  }

  async getChatSession(userId: string, sessionId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!session) {
      throw new NotFoundException('Chat session not found');
    }

    return session;
  }

  async sendMessage(userId: string, sessionId: string, messageDto: ChatMessageDto) {
    const session = await this.validateSession(userId, sessionId);

    try {
      const message = await this.prisma.chatMessage.create({
        data: {
          content: messageDto.content,
          sender: 'USER',
          session: {
            connect: { id: sessionId }
          }
        }
      });

      return {
        messageId: message.id,
        content: message.content,
        timestamp: message.createdAt,
        status: 'SENT'
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to send message'
      );
    }
  }

  async endChatSession(userId: string, sessionId: string) {
    const session = await this.validateSession(userId, sessionId);

    try {
      const updatedSession = await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: {
          status: 'CLOSED',
          endedAt: new Date()
        }
      });

      return {
        sessionId: updatedSession.id,
        status: updatedSession.status,
        endedAt: updatedSession.endedAt
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to end chat session'
      );
    }
  }

  private async validateSession(userId: string, sessionId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId,
        status: {
          not: 'CLOSED'
        }
      }
    });

    if (!session) {
      throw new NotFoundException('Active chat session not found');
    }

    return session;
  }

  private calculateEstimatedWaitTime(): string {
    // This is a simplified example - in production, you'd want to:
    // 1. Check number of active support agents
    // 2. Check current queue length
    // 3. Consider historical wait times
    // 4. Factor in time of day/week
    return '2 minutes';
  }
} 