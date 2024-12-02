import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fetch from 'node-fetch';

@Injectable()
export class KeepaliveService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KeepaliveService.name);
  private keepaliveInterval: NodeJS.Timeout | null = null;
  private readonly KEEPALIVE_INTERVAL = 30000; // 30 seconds
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 5000; // 5 seconds

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Wait a bit for the server to fully start
    setTimeout(async () => {
      await this.initializeHealthCheck();
    }, 5000); // Wait 5 seconds before first check
  }

  onModuleDestroy() {
    this.stopKeepalive();
    this.logger.log('Keepalive service stopped');
  }

  private async initializeHealthCheck() {
    let retries = 0;
    while (retries < this.MAX_RETRIES) {
      if (await this.checkHealth()) {
        this.startKeepalive();
        this.logger.log('Keepalive service started successfully');
        return;
      }
      retries++;
      if (retries < this.MAX_RETRIES) {
        this.logger.log(`Retrying health check in ${this.RETRY_DELAY/1000} seconds... (Attempt ${retries + 1}/${this.MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
      }
    }
    this.logger.error('Failed to initialize health check after maximum retries');
  }

  private async checkHealth(): Promise<boolean> {
    try {
      const port = this.configService.get('PORT') || 3500;
      const baseUrl = this.configService.get('BASE_URL') || `http://localhost:${port}`;
      const response = await fetch(`${baseUrl}/health`);
      
      if (!response.ok) {
        this.logger.warn(`Health check failed with status: ${response.status}`);
        return false;
      }
      
      const data = await response.json();
      this.logger.debug('Health check successful:', data);
      return true;
    } catch (error) {
      this.logger.error('Health check failed:', error.message);
      return false;
    }
  }

  private startKeepalive() {
    if (this.keepaliveInterval) {
      return;
    }

    this.keepaliveInterval = setInterval(async () => {
      await this.checkHealth();
    }, this.KEEPALIVE_INTERVAL);
  }

  private stopKeepalive() {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }
  }
} 