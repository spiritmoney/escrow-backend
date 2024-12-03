import { Controller, Get, Query, UseGuards, HttpStatus } from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiQuery 
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { TransactionService } from '../services/transaction.service';
import { GetTransactionsQueryDto, TransactionType, TransactionStatus } from '../dto/transaction.dto';
import { systemResponses } from '../../contracts/system.responses';

@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionController {
  constructor(private transactionService: TransactionService) {}

  @Get()
  @ApiOperation({ summary: 'Get user transaction history' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: TransactionType,
    description: 'Filter by transaction type'
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: TransactionStatus,
    description: 'Filter by transaction status'
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by transaction ID or recipient name'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: systemResponses.EN.TRANSACTION_HISTORY_RETRIEVED,
    schema: {
      properties: {
        message: {
          type: 'string',
          example: systemResponses.EN.TRANSACTION_HISTORY_RETRIEVED
        },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'TX123' },
              date: { type: 'string', example: '2024-02-20T12:00:00Z' },
              type: { type: 'string', enum: Object.values(TransactionType) },
              amount: { type: 'number', example: 500.00 },
              currency: { type: 'string', example: 'USD' },
              status: { type: 'string', enum: Object.values(TransactionStatus) },
              note: { type: 'string', example: 'Payment for services' },
              recipient: { type: 'string', example: 'John Doe' },
              sender: { type: 'string', example: 'Jane Smith' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: systemResponses.EN.TRANSACTION_FETCH_ERROR 
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: systemResponses.EN.AUTHENTICATION_FAILED 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: systemResponses.EN.TRANSACTIONS_NOT_FOUND 
  })
  async getTransactions(
    @CurrentUser() user,
    @Query() query: GetTransactionsQueryDto
  ) {
    return this.transactionService.getUserTransactions(user.id, query);
  }
} 