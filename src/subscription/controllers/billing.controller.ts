import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PaymentMethodService } from '../services/payment-method.service';
import { BillingHistoryService } from '../services/billing-history.service';
import { 
  CardPaymentMethodDto, 
  BankTransferMethodDto, 
  AutoPaymentSettingsDto 
} from '../dto/payment-method.dto';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(
    private paymentMethodService: PaymentMethodService,
    private billingHistoryService: BillingHistoryService,
  ) {}

  @Get('payment-methods')
  @ApiOperation({ summary: 'Get all payment methods' })
  async getPaymentMethods(@CurrentUser() user) {
    return this.paymentMethodService.getPaymentMethods(user.id);
  }

  @Post('payment-methods/card')
  @ApiOperation({ summary: 'Add card payment method' })
  async addCardPaymentMethod(
    @CurrentUser() user,
    @Body() cardDto: CardPaymentMethodDto,
  ) {
    return this.paymentMethodService.addCardPaymentMethod(user.id, cardDto);
  }

  @Post('payment-methods/bank')
  @ApiOperation({ summary: 'Add bank transfer payment method' })
  async addBankTransferMethod(
    @CurrentUser() user,
    @Body() bankDto: BankTransferMethodDto,
  ) {
    return this.paymentMethodService.addBankTransferMethod(user.id, bankDto);
  }

  @Put('payment-methods/:id/default')
  @ApiOperation({ summary: 'Set payment method as default' })
  async setDefaultPaymentMethod(
    @CurrentUser() user,
    @Param('id') paymentMethodId: string,
  ) {
    return this.paymentMethodService.updateDefaultPaymentMethod(user.id, paymentMethodId);
  }

  @Delete('payment-methods/:id')
  @ApiOperation({ summary: 'Delete payment method' })
  async deletePaymentMethod(
    @CurrentUser() user,
    @Param('id') paymentMethodId: string,
  ) {
    return this.paymentMethodService.deletePaymentMethod(user.id, paymentMethodId);
  }

  @Put('auto-payment-settings')
  @ApiOperation({ summary: 'Update auto-payment settings' })
  async updateAutoPaymentSettings(
    @CurrentUser() user,
    @Body() settings: AutoPaymentSettingsDto,
  ) {
    return this.paymentMethodService.updateAutoPaymentSettings(user.id, settings);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get billing history' })
  async getBillingHistory(@CurrentUser() user) {
    return this.billingHistoryService.getBillingHistory(user.id);
  }
} 