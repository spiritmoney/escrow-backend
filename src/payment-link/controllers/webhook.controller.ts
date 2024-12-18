import { Controller, Post, Headers, RawBodyRequest, Req, BadRequestException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StripeService } from '../../services/stripe/stripe.service';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  
  constructor(
    private stripeService: StripeService,
    private configService: ConfigService,
  ) {}

  @Post('stripe')
  @ApiOperation({ summary: 'Handle Stripe webhook events' })
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: RawBodyRequest<Request>,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const payload = request.rawBody;
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    
    // Use different webhook secrets for production and local development
    const webhookSecret = isProduction 
      ? this.configService.get('STRIPE_WEBHOOK_SECRET_PROD')
      : this.configService.get('STRIPE_WEBHOOK_SECRET_LOCAL');

    try {
      await this.stripeService.handleWebhook(
        signature,
        payload,
        webhookSecret
      );
      
      this.logger.log(`Webhook handled successfully in ${isProduction ? 'production' : 'development'} mode`);
      return { received: true };
    } catch (error) {
      this.logger.error(`Webhook error: ${error.message}`);
      throw new BadRequestException(error.message);
    }
  }
} 