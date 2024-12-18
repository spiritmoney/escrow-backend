import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(private configService: ConfigService) {
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'), {
      apiVersion: '2023-10-16' as Stripe.LatestApiVersion,
    });
  }

  async createCheckoutSession(params: {
    amount: number;
    currency: string;
    customerId: string;
    customerEmail: string;
    paymentLinkId: string;
    transactionId: string;
    successUrl: string;
    cancelUrl: string;
    metadata: any;
    stripeAccountId: string;
  }) {
    try {
      return await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: params.currency,
              product_data: {
                name: 'Payment Link Transaction',
              },
              unit_amount: params.amount,
            },
            quantity: 1,
          },
        ],
        customer_email: params.customerEmail,
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: params.metadata,
        payment_intent_data: {
          metadata: params.metadata,
        },
        stripeAccount: params.stripeAccountId, // Connect account ID
      } as Stripe.Checkout.SessionCreateParams);
    } catch (error) {
      this.logger.error('Error creating checkout session:', error);
      throw error;
    }
  }

  async handleWebhook(
    signature: string,
    payload: Buffer,
    webhookSecret: string
  ): Promise<Stripe.Event> {
    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      );
    } catch (error) {
      this.logger.error('Webhook signature verification failed:', error);
      throw error;
    }
  }
} 