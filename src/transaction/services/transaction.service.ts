import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GetTransactionsQueryDto, TransactionType, TransactionStatus } from '../dto/transaction.dto';
import { systemResponses } from '../../contracts/system.responses';

@Injectable()
export class TransactionService {
  constructor(private prisma: PrismaService) {}

  async getUserTransactions(userId: string, query: GetTransactionsQueryDto) {
    try {
      // Validate user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new NotFoundException(systemResponses.EN.USER_NOT_FOUND);
      }

      // Validate enum values if provided
      if (query.type && !Object.values(TransactionType).includes(query.type)) {
        throw new BadRequestException(systemResponses.EN.INVALID_TRANSACTION_TYPE);
      }

      if (query.status && !Object.values(TransactionStatus).includes(query.status)) {
        throw new BadRequestException(systemResponses.EN.INVALID_TRANSACTION_STATUS);
      }

      const where = {
        OR: [
          { senderId: userId },
          { recipientId: userId }
        ],
        AND: []
      };

      // Add filters
      if (query.type) {
        where.AND.push({ type: query.type });
      }

      if (query.status) {
        where.AND.push({ status: query.status });
      }

      if (query.search) {
        where.AND.push({
          OR: [
            { id: { contains: query.search, mode: 'insensitive' } },
            {
              recipient: {
                OR: [
                  { firstName: { contains: query.search, mode: 'insensitive' } },
                  { lastName: { contains: query.search, mode: 'insensitive' } },
                ]
              }
            }
          ]
        });
      }

      const transactions = await this.prisma.transaction.findMany({
        where,
        include: {
          sender: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          },
          recipient: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!transactions.length) {
        throw new NotFoundException(systemResponses.EN.TRANSACTIONS_NOT_FOUND);
      }

      return {
        message: systemResponses.EN.TRANSACTION_HISTORY_RETRIEVED,
        data: transactions.map(tx => ({
          id: tx.id,
          date: tx.createdAt,
          type: tx.type,
          amount: tx.amount,
          currency: tx.currency,
          status: tx.status,
          note: tx.note,
          recipient: tx.recipient ? 
            `${tx.recipient.firstName} ${tx.recipient.lastName}` : 
            tx.recipientWallet,
          sender: tx.sender ? 
            `${tx.sender.firstName} ${tx.sender.lastName}` : 
            null
        }))
      };

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(systemResponses.EN.TRANSACTION_FETCH_ERROR);
    }
  }
} 