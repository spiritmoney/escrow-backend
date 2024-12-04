import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const configService = app.get(ConfigService);
  const port = configService.get<number>('port');
  
  // CORS Configuration
  app.enableCors({
    origin: [
      'http://localhost:3000',      // Local development
      'http://localhost:5173',      // Vite default
      'https://espeespay.vercel.app', // Production frontend
      /\.vercel\.app$/,            // Any Vercel deployment
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-api-key'],
  });
  
  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('EspeePay API')
    .setDescription('The EspeePay API documentation')
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addBearerAuth()
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  
  // Fix the invalid schema in the document
  if (document.paths['/balance/convert']) {
    const response200 = document.paths['/balance/convert'].post.responses['200'];
    if ('schema' in response200) {
      delete (response200 as any).schema;
    }
    
    if (!('$ref' in response200)) {
      response200.content = {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              convertedAmount: {
                type: 'number',
                example: 1800
              },
              rate: {
                type: 'number',
                example: 1800
              },
              from: {
                type: 'string',
                example: 'ESP'
              },
              to: {
                type: 'string',
                example: 'NGN'
              }
            }
          }
        }
      };
    }
  }
  
  SwaggerModule.setup('api', app, document);
  
  // Save OpenAPI specification to file
  const fs = require('fs');
  const path = require('path');
  fs.writeFileSync(
    path.join(__dirname, '../openapi-spec.json'),
    JSON.stringify(document, null, 2),
    { encoding: 'utf8' }
  );
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));
  
  app.useGlobalFilters(new GlobalExceptionFilter());
  
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`API Documentation available at: http://localhost:${port}/api`);
}
bootstrap();
