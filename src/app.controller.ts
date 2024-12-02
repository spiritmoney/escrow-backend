import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller()
export class AppController {
  @ApiOperation({ summary: 'Lightweight health check endpoint' })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is healthy',
    schema: {
      example: { status: 'ok' }
    }
  })
  @Get('health')
  @HttpCode(HttpStatus.OK)
  healthCheck() {
    return { status: 'ok' };
  }
}
