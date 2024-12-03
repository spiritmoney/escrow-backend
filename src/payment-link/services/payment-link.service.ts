import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { BlockchainService } from '../../services/blockchain/blockchain.service';
import { WalletService } from '../../wallet/wallet.service';
import { CreatePaymentLinkDto, UpdatePaymentLinkSettingsDto } from '../dto/payment-link.dto';
import { ConfigService } from '@nestjs/config';
import { systemResponses } from '../../contracts/system.responses';
import { PaymentLinkType } from '../dto/payment-link.dto';
import { PaymentLinkTransactionService } from './payment-link-transaction.service';

@Injectable()
export class PaymentLinkService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private blockchainService: BlockchainService,
    private walletService: WalletService,
    private paymentLinkTransactionService: PaymentLinkTransactionService,
  ) {}

  async getActiveLinks(userId: string) {
    const links = await this.prisma.paymentLink.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Fetch blockchain status for each link
    const linksWithStatus = await Promise.all(
      links.map(async (link) => {
        if (link.escrowAddress) {
          try {
            const escrowDetails = await this.blockchainService.getEscrowDetails(
              link.escrowAddress
            );
            return { 
              ...link, 
              blockchainStatus: escrowDetails.status,
              role: link.type === PaymentLinkType.SELLING ? 'Seller' : 'Buyer'
            };
          } catch (error) {
            console.error(`Error fetching escrow details for ${link.id}:`, error);
            return link;
          }
        }
        return {
          ...link,
          role: link.type === PaymentLinkType.SELLING ? 'Seller' : 'Buyer'
        };
      })
    );

    return { links: linksWithStatus };
  }

  async createLink(userId: string, createLinkDto: CreatePaymentLinkDto) {
    const baseUrl = this.configService.get<string>('RENDER_URL');
    const linkId = Math.random().toString(36).substring(7);
    const url = `${baseUrl}/pay/link-${linkId}`;

    // Get user's wallet
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new BadRequestException('User wallet not found');
    }

    // Create payment link based on type
    const paymentLinkData: Prisma.PaymentLinkCreateInput = {
      name: createLinkDto.name,
      url,
      defaultAmount: createLinkDto.defaultAmount,
      defaultCurrency: createLinkDto.defaultCurrency,
      type: createLinkDto.type,
      transactionType: createLinkDto.transactionType,
      description: createLinkDto.description,
      createdBy: {
        connect: { id: userId }
      }
    };

    if (createLinkDto.type === PaymentLinkType.SELLING) {
      paymentLinkData['sellerAddress'] = wallet.address;
    } else {
      paymentLinkData['buyerAddress'] = wallet.address;
    }

    // Create payment link
    return this.prisma.paymentLink.create({
      data: paymentLinkData,
    });
  }

  async updateSettings(userId: string, settingsDto: UpdatePaymentLinkSettingsDto) {
    try {
      await this.prisma.paymentLinkSettings.upsert({
        where: { userId },
        create: {
          userId,
          defaultCurrency: settingsDto.defaultCurrency,
          defaultExpirationTime: settingsDto.defaultExpirationTime,
        },
        update: {
          defaultCurrency: settingsDto.defaultCurrency,
          defaultExpirationTime: settingsDto.defaultExpirationTime,
        },
      });

      return { message: 'Settings updated successfully' };
    } catch (error) {
      throw new BadRequestException(systemResponses.EN.SETTINGS_UPDATE_FAILED);
    }
  }

  async initiateTransaction(
    linkId: string,
    userId: string,
    transactionDto: any
  ) {
    return this.paymentLinkTransactionService.initiateTransaction(
      linkId,
      userId,
      transactionDto.amount,
      transactionDto.currency
    );
  }
} 