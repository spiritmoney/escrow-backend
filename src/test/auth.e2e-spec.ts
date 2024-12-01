import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('should register a new user', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: 'Test123!@#',
        firstName: 'John',
        lastName: 'Doe',
        country: 'US',
        organisation: 'Test Org',
        role: 'DEVELOPER'
      })
      .expect(201)
      .expect(res => {
        expect(res.body.user).toBeDefined();
        expect(res.body.wallet).toBeDefined();
        expect(res.body.message).toBeDefined();
      });
  });

  // Add more tests for other endpoints
}); 