import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
export class IntegrationsController {
  private readonly logger = new Logger(IntegrationsController.name);

  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@CurrentUser() user: AuthUser) {
    return this.integrationsService.list(user.organizationId);
  }

  @Post('connect/:platform')
  @UseGuards(JwtAuthGuard)
  async connectByParam(
    @CurrentUser() user: AuthUser,
    @Param('platform') platform: string,
  ) {
    const result = await this.integrationsService.getOAuthUrl(user.organizationId, platform, user.id);
    return { authUrl: result.url };
  }

  @Post('connect')
  @UseGuards(JwtAuthGuard)
  async connect(
    @CurrentUser() user: AuthUser,
    @Body() body: { platform: string },
  ) {
    const result = await this.integrationsService.getOAuthUrl(user.organizationId, body.platform, user.id);
    return { authUrl: result.url };
  }

  /**
   * OAuth callback — browser redirects here from platform.
   * The "state" query param carries the organizationId.
   * This endpoint does NOT require JWT auth because the user arrives
   * via a browser redirect from the platform's OAuth page.
   * We extract the user from the auth cookie if present.
   */
  @Get('callback/:platform')
  async callback(
    @Req() req: Request,
    @Res() res: Response,
    @Param('platform') platform: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
    @Query('error_description') errorDesc?: string,
  ) {
    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'
    ).replace(/\/$/, '');

    // Handle OAuth errors (user denied, etc.)
    if (error) {
      this.logger.warn(`OAuth error for ${platform}: ${error} — ${errorDesc}`);
      return res.redirect(
        `${frontendUrl}/integrations?error=${encodeURIComponent(errorDesc || error)}`,
      );
    }

    if (!code || !state) {
      return res.redirect(
        `${frontendUrl}/integrations?error=${encodeURIComponent('Missing authorization code')}`,
      );
    }

    // state = organizationId (passed when we built the OAuth URL)
    const organizationId = state;

    // Try to get userId from auth cookie for per-user credential lookup
    let userId: string | undefined;
    try {
      const authCookie = req.cookies?.auth;
      if (authCookie) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const jwt = require('jsonwebtoken');
        const secret = this.configService.get<string>('JWT_SECRET');
        const decoded = jwt.verify(authCookie, secret) as any;
        userId = decoded.sub || decoded.userId;
      }
    } catch (err) {
      this.logger.warn('Could not extract userId from auth cookie for OAuth callback');
    }

    try {
      await this.integrationsService.handleOAuthCallback(
        organizationId,
        platform,
        code,
        userId,
      );

      // Redirect back to integrations page with success
      return res.redirect(`${frontendUrl}/integrations?connected=${platform}`);
    } catch (err: any) {
      this.logger.error(`OAuth callback failed for ${platform}: ${err.message}`);
      return res.redirect(
        `${frontendUrl}/integrations?error=${encodeURIComponent(err.message || 'Connection failed')}`,
      );
    }
  }

  /**
   * Facebook webhook verification endpoint.
   * Facebook sends a GET request with hub.mode, hub.verify_token, and hub.challenge.
   */
  @Get('webhooks/facebook')
  async facebookWebhookVerify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const expectedToken =
      this.configService.get<string>('FACEBOOK_WEBHOOK_VERIFY_TOKEN') || 'postiz_webhook_verify';

    if (mode === 'subscribe' && verifyToken === expectedToken) {
      this.logger.log('Facebook webhook verified successfully');
      return res.status(200).send(challenge);
    }

    this.logger.warn(`Facebook webhook verification failed: mode=${mode}`);
    return res.status(403).send('Verification failed');
  }

  /**
   * Facebook webhook events (page post updates, etc.)
   */
  @Post('webhooks/facebook')
  async facebookWebhookEvent(
    @Body() body: any,
    @Res() res: Response,
  ) {
    this.logger.log(`Facebook webhook event: ${JSON.stringify(body).substring(0, 200)}`);

    // Always respond 200 quickly to acknowledge receipt
    // Process events asynchronously in production
    if (body.object === 'page') {
      for (const entry of body.entry || []) {
        this.logger.log(`Facebook page event for page ${entry.id}`);
        // TODO: Process page events (post published, comments, etc.)
      }
    }

    return res.status(200).send('EVENT_RECEIVED');
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { name?: string; disabled?: boolean; metadata?: Record<string, any> },
  ) {
    return this.integrationsService.update(user.organizationId, id, body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async patch(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { name?: string; disabled?: boolean; isActive?: boolean; metadata?: Record<string, any> },
  ) {
    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.disabled !== undefined) data.disabled = body.disabled;
    if (body.isActive !== undefined) data.disabled = !body.isActive;
    if (body.metadata !== undefined) data.metadata = body.metadata;
    return this.integrationsService.update(user.organizationId, id, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.integrationsService.remove(user.organizationId, id);
  }

  @Put(':id/profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { settings: Record<string, any>; preferredTimes?: number[] },
  ) {
    return this.integrationsService.updateProfile(user.organizationId, id, body);
  }

  @Get(':id/profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.integrationsService.getProfile(user.organizationId, id);
  }
}
