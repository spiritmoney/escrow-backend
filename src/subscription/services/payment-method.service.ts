import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CardPaymentMethodDto, BankTransferMethodDto, AutoPaymentSettingsDto } from '../dto/payment-method.dto';
import { systemResponses } from '../../contracts/system.responses';
import { SUPPORTED_BANKS } from '../constants/banks.constant';

@Injectable()
export class PaymentMethodService {
  constructor(private prisma: PrismaService) {}

  async addCardPaymentMethod(userId: string, cardDto: CardPaymentMethodDto) {
    try {
      const maskedCardNumber = this.maskCardNumber(cardDto.cardNumber);
      
      const paymentMethod = await this.prisma.paymentMethod.create({
        data: {
          type: 'CARD',
          userId,
          details: {
            lastFour: cardDto.cardNumber.slice(-4),
            expiryDate: cardDto.expiryDate,
            cardholderName: cardDto.cardholderName,
            maskedNumber: maskedCardNumber,
          },
          isDefault: cardDto.setAsDefault || false,
        },
      });

      if (cardDto.setAsDefault) {
        await this.updateDefaultPaymentMethod(userId, paymentMethod.id);
      }

      return {
        message: systemResponses.EN.PAYMENT_METHOD_ADDED,
        paymentMethod
      };
    } catch (error) {
      throw new BadRequestException(systemResponses.EN.PAYMENT_METHOD_UPDATE_FAILED);
    }
  }

  async addBankTransferMethod(userId: string, bankDto: BankTransferMethodDto) {
    try {
      const bank = SUPPORTED_BANKS.find(b => b.name === bankDto.bankName);
      if (!bank) {
        throw new BadRequestException(systemResponses.EN.INVALID_BANK_SELECTED);
      }

      const paymentMethod = await this.prisma.paymentMethod.create({
        data: {
          type: 'BANK_TRANSFER',
          userId,
          details: {
            bankName: bankDto.bankName,
            bankCode: bank.code,
            accountHolderName: bankDto.accountHolderName,
            lastFour: bankDto.accountNumber.slice(-4),
            accountType: bankDto.accountType,
          },
          isDefault: bankDto.setAsDefault || false,
        },
      });

      if (bankDto.setAsDefault) {
        await this.updateDefaultPaymentMethod(userId, paymentMethod.id);
      }

      return {
        message: systemResponses.EN.PAYMENT_METHOD_ADDED,
        paymentMethod
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(systemResponses.EN.PAYMENT_METHOD_UPDATE_FAILED);
    }
  }

  async getPaymentMethods(userId: string) {
    try {
      const paymentMethods = await this.prisma.paymentMethod.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      return {
        paymentMethods,
      };
    } catch (error) {
      throw new BadRequestException(systemResponses.EN.PAYMENT_METHOD_FETCH_ERROR);
    }
  }

  async updateDefaultPaymentMethod(userId: string, paymentMethodId: string) {
    try {
      await this.prisma.paymentMethod.updateMany({
        where: { userId },
        data: { isDefault: false },
      });

      await this.prisma.paymentMethod.update({
        where: { id: paymentMethodId },
        data: { isDefault: true },
      });

      return {
        message: systemResponses.EN.DEFAULT_PAYMENT_METHOD_UPDATED
      };
    } catch (error) {
      throw new BadRequestException(systemResponses.EN.PAYMENT_METHOD_UPDATE_FAILED);
    }
  }

  async deletePaymentMethod(userId: string, paymentMethodId: string) {
    try {
      const paymentMethod = await this.prisma.paymentMethod.findFirst({
        where: { id: paymentMethodId, userId },
      });

      if (!paymentMethod) {
        throw new NotFoundException(systemResponses.EN.PAYMENT_METHOD_NOT_FOUND);
      }

      await this.prisma.paymentMethod.delete({
        where: { id: paymentMethodId },
      });

      return {
        message: systemResponses.EN.PAYMENT_METHOD_DELETED
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(systemResponses.EN.PAYMENT_METHOD_UPDATE_FAILED);
    }
  }

  async updateAutoPaymentSettings(userId: string, settings: AutoPaymentSettingsDto) {
    try {
      await this.prisma.autoPaymentSettings.upsert({
        where: { userId },
        create: {
          userId,
          ...settings,
        },
        update: settings,
      });

      return {
        message: systemResponses.EN.AUTO_PAYMENT_SETTINGS_UPDATED
      };
    } catch (error) {
      throw new BadRequestException(systemResponses.EN.SETTINGS_UPDATE_FAILED);
    }
  }

  private maskCardNumber(cardNumber: string): string {
    return `**** **** **** ${cardNumber.slice(-4)}`;
  }
} 