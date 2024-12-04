import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  Get,
  Param,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth, 
  ApiSecurity 
} from '@nestjs/swagger';
import { CombinedAuthGuard } from '../../auth/guards/combined-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { LiveChatService } from '../services/live-chat.service';
import { InitiateChatDto, ChatMessageDto } from '../dto/live-chat.dto';
import { systemResponses } from '../../contracts/system.responses';

@ApiTags('support')
@ApiBearerAuth()
@ApiSecurity('x-api-key')
@UseGuards(CombinedAuthGuard)
@Controller('support/live-chat')
export class LiveChatController {
  constructor(private liveChatService: LiveChatService) {}

  @Post('initiate')
  @ApiOperation({ summary: 'Initiate a live chat session' })
  @ApiResponse({
    status: 201,
    description: 'Chat session initiated successfully',
    schema: {
      example: {
        sessionId: 'chat_123',
        status: 'ACTIVE',
        createdAt: '2024-03-10T12:00:00Z',
        estimatedWaitTime: '2 minutes'
      }
    }
  })
  async initiateChat(
    @CurrentUser() user,
    @Body() initiateChatDto: InitiateChatDto
  ) {
    return this.liveChatService.initiateChat(user.id, initiateChatDto);
  }

  @Get('session/:sessionId')
  @ApiOperation({ summary: 'Get chat session details' })
  @ApiResponse({
    status: 200,
    description: 'Chat session details retrieved successfully',
    schema: {
      example: {
        sessionId: 'chat_123',
        status: 'ACTIVE',
        messages: [
          {
            id: 'msg_1',
            content: 'Hello, how can I help you today?',
            sender: 'AGENT',
            timestamp: '2024-03-10T12:00:00Z'
          }
        ]
      }
    }
  })
  async getChatSession(
    @CurrentUser() user,
    @Param('sessionId') sessionId: string
  ) {
    return this.liveChatService.getChatSession(user.id, sessionId);
  }

  @Post('session/:sessionId/message')
  @ApiOperation({ summary: 'Send a message in chat session' })
  @ApiResponse({
    status: 201,
    description: 'Message sent successfully',
    schema: {
      example: {
        messageId: 'msg_1',
        content: 'Hello, I need help with...',
        timestamp: '2024-03-10T12:00:00Z',
        status: 'SENT'
      }
    }
  })
  async sendMessage(
    @CurrentUser() user,
    @Param('sessionId') sessionId: string,
    @Body() messageDto: ChatMessageDto
  ) {
    return this.liveChatService.sendMessage(user.id, sessionId, messageDto);
  }

  @Post('session/:sessionId/end')
  @ApiOperation({ summary: 'End chat session' })
  @ApiResponse({
    status: 200,
    description: 'Chat session ended successfully',
    schema: {
      example: {
        sessionId: 'chat_123',
        status: 'CLOSED',
        endedAt: '2024-03-10T12:30:00Z'
      }
    }
  })
  async endChatSession(
    @CurrentUser() user,
    @Param('sessionId') sessionId: string
  ) {
    return this.liveChatService.endChatSession(user.id, sessionId);
  }
} 