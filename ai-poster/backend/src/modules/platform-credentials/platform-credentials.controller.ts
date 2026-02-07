import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { PlatformCredentialsService } from './platform-credentials.service';

class UpsertPlatformCredentialsDto {
  @IsObject()
  @IsNotEmpty()
  credentials: Record<string, any>;

  @IsString()
  @IsOptional()
  label?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

@Controller('platform-credentials')
@UseGuards(JwtAuthGuard)
export class PlatformCredentialsController {
  constructor(
    private readonly platformCredentialsService: PlatformCredentialsService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return this.platformCredentialsService.list(user.id, user.organizationId);
  }

  @Get(':platform')
  async getByPlatform(
    @CurrentUser() user: AuthUser,
    @Param('platform') platform: string,
  ) {
    return this.platformCredentialsService.getByPlatform(
      user.id,
      user.organizationId,
      platform,
    );
  }

  @Put(':platform')
  async upsert(
    @CurrentUser() user: AuthUser,
    @Param('platform') platform: string,
    @Body() body: UpsertPlatformCredentialsDto,
  ) {
    return this.platformCredentialsService.upsert(
      user.id,
      user.organizationId,
      platform,
      body,
    );
  }

  @Delete(':platform')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('platform') platform: string,
  ) {
    return this.platformCredentialsService.remove(
      user.id,
      user.organizationId,
      platform,
    );
  }

  @Post(':platform/test')
  async testCredentials(
    @CurrentUser() user: AuthUser,
    @Param('platform') platform: string,
  ) {
    return this.platformCredentialsService.testCredentials(
      user.id,
      user.organizationId,
      platform,
    );
  }
}
