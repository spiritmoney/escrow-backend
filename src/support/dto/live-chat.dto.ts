import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitiateChatDto {
  @ApiProperty({
    example: 'Payment Processing Issue',
    description: 'Initial topic or subject for the chat'
  })
  @IsString()
  @IsNotEmpty()
  topic: string;

  @ApiProperty({
    example: 'I need help with processing a payment',
    description: 'Initial message to start the chat',
    required: false
  })
  @IsString()
  @IsOptional()
  initialMessage?: string;
}

export class ChatMessageDto {
  @ApiProperty({
    example: 'Hello, I need assistance with...',
    description: 'Chat message content'
  })
  @IsString()
  @IsNotEmpty()
  content: string;
} 