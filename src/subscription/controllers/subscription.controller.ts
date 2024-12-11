import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SubscriptionService } from '../services/subscription.service';
import { UpdateSubscriptionDto, SubscriptionPlan } from '../dto/subscription.dto';
@ApiTags('subscription')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscription')
export class SubscriptionController {
  constructor(private subscriptionService: SubscriptionService) {}

  @Get('plan')
  @ApiOperation({ summary: 'Get current subscription plan' })
  @ApiResponse({
    status: 200,
    description: 'Current subscription plan details',
    type: SubscriptionPlan,
  })
  async getCurrentPlan(@CurrentUser() user): Promise<SubscriptionPlan> {
    return this.subscriptionService.getCurrentPlan(user.id);
  }

  @Post('upgrade')
  @ApiOperation({ summary: 'Upgrade subscription plan' })
  @ApiResponse({
    status: 200,
    description: 'Subscription plan upgraded successfully',
    type: SubscriptionPlan,
  })
  async upgradePlan(
    @CurrentUser() user,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto
  ): Promise<SubscriptionPlan> {
    return this.subscriptionService.upgradePlan(user.id, updateSubscriptionDto.planType);
  }
} 