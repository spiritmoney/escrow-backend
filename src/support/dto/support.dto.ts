import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSupportTicketDto {
  @ApiProperty({
    example: 'Payment Issue',
    description: 'Subject of the support ticket'
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  subject: string;

  @ApiProperty({
    example: 'I am having trouble processing a payment...',
    description: 'Detailed description of the issue'
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  message: string;
} 