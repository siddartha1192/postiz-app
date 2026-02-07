import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

import { DatabaseModule } from './database.module';
import { PublishPostProcessor } from './processors/publish-post.processor';
import { GenerateContentProcessor } from './processors/generate-content.processor';
import { ProcessImageProcessor } from './processors/process-image.processor';
import { RefreshTokenProcessor } from './processors/refresh-token.processor';
import { AnalyticsSyncProcessor } from './processors/analytics-sync.processor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        if (redisUrl) {
          const url = new URL(redisUrl);
          return {
            connection: {
              host: url.hostname,
              port: parseInt(url.port || '6379', 10),
              password: url.password || undefined,
            },
          };
        }
        return {
          connection: {
            host: config.get<string>('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6379),
          },
        };
      },
    }),

    // Register all queues
    BullModule.registerQueue(
      { name: 'publish-post' },
      { name: 'generate-content' },
      { name: 'process-image' },
      { name: 'refresh-token' },
      { name: 'analytics-sync' },
    ),

    DatabaseModule,
  ],

  providers: [
    PublishPostProcessor,
    GenerateContentProcessor,
    ProcessImageProcessor,
    RefreshTokenProcessor,
    AnalyticsSyncProcessor,
  ],
})
export class WorkerModule {}
