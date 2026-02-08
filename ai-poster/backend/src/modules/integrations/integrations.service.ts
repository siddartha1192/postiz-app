import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database.module';

interface TokenExchangeResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  profileId?: string;
  profileName?: string;
  profilePicture?: string;
}

/** OAuth configuration per platform (client IDs and scopes would come from env vars) */
const OAUTH_CONFIG: Record<
  string,
  { authorizeUrl: string; scopes: string }
> = {
  TWITTER: {
    authorizeUrl: 'https://twitter.com/i/oauth2/authorize',
    scopes: 'tweet.read tweet.write users.read offline.access',
  },
  LINKEDIN: {
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    scopes: 'r_liteprofile w_member_social',
  },
  LINKEDIN_PAGE: {
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    scopes: 'r_organization_social w_organization_social rw_organization_admin',
  },
  FACEBOOK: {
    authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    scopes: 'pages_show_list,pages_manage_posts,pages_read_engagement,pages_read_user_content',
  },
  INSTAGRAM: {
    authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    scopes: 'instagram_basic,instagram_content_publish,pages_show_list',
  },
  YOUTUBE: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: 'https://www.googleapis.com/auth/youtube.upload',
  },
  TIKTOK: {
    authorizeUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    scopes: 'user.info.basic,video.publish',
  },
  REDDIT: {
    authorizeUrl: 'https://www.reddit.com/api/v1/authorize',
    scopes: 'submit identity',
  },
  PINTEREST: {
    authorizeUrl: 'https://www.pinterest.com/oauth/',
    scopes: 'boards:read,pins:read,pins:write',
  },
  THREADS: {
    authorizeUrl: 'https://www.threads.net/oauth/authorize',
    scopes: 'threads_basic,threads_content_publish',
  },
  DISCORD: {
    authorizeUrl: 'https://discord.com/api/oauth2/authorize',
    scopes: 'bot',
  },
  SLACK: {
    authorizeUrl: 'https://slack.com/oauth/v2/authorize',
    scopes: 'chat:write,channels:read',
  },
  MASTODON: {
    authorizeUrl: '', // Instance-specific
    scopes: 'read write',
  },
  BLUESKY: {
    authorizeUrl: '', // Uses app password, not OAuth
    scopes: '',
  },
  DRIBBBLE: {
    authorizeUrl: 'https://dribbble.com/oauth/authorize',
    scopes: 'public upload',
  },
};

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async list(organizationId: string) {
    return this.prisma.integration.findMany({
      where: { organizationId },
      include: {
        platformProfile: true,
        _count: { select: { posts: true, campaignChannels: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retrieve per-user platform credentials, falling back to env vars.
   */
  private async getClientCredentials(
    userId: string,
    organizationId: string,
    platform: string,
  ): Promise<{ clientId: string; clientSecret?: string }> {
    // 1. Try per-user credentials from database
    const userCred = await this.prisma.userPlatformCredential.findUnique({
      where: {
        userId_organizationId_platform: {
          userId,
          organizationId,
          platform: platform as any,
        },
      },
    });

    if (userCred && userCred.isActive) {
      const creds = userCred.credentials as Record<string, string>;
      if (creds.clientId) {
        return {
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
        };
      }
    }

    // 2. Fallback to environment variables
    const envClientId = this.configService.get<string>(`${platform}_CLIENT_ID`);
    const envClientSecret = this.configService.get<string>(`${platform}_CLIENT_SECRET`);

    if (envClientId) {
      return { clientId: envClientId, clientSecret: envClientSecret };
    }

    throw new BadRequestException(
      `No credentials configured for ${platform}. Please add your API credentials in Settings > Credentials.`,
    );
  }

  /**
   * Get the public-facing base URL for OAuth redirects.
   * Uses FRONTEND_URL (the public domain where nginx proxies /api/ to backend)
   * since OAuth callbacks need to hit the public URL, not the internal container URL.
   */
  private getPublicBaseUrl(): string {
    // FRONTEND_URL is the public domain (e.g., http://climcrm.com)
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    if (frontendUrl) {
      return frontendUrl.replace(/\/$/, '');
    }
    // Fallback to BACKEND_URL if set
    const backendUrl = this.configService.get<string>('BACKEND_URL');
    if (backendUrl) {
      return backendUrl.replace(/\/$/, '');
    }
    return 'http://localhost:3001';
  }

  async getOAuthUrl(
    organizationId: string,
    platform: string,
    userId?: string,
  ): Promise<{ url: string; platform: string }> {
    const normalizedPlatform = platform.toUpperCase();
    const config = OAUTH_CONFIG[normalizedPlatform];

    if (!config || !config.authorizeUrl) {
      throw new BadRequestException(
        `Platform ${platform} does not support OAuth or requires manual setup`,
      );
    }

    const publicBaseUrl = this.getPublicBaseUrl();
    const redirectUri = `${publicBaseUrl}/api/integrations/callback/${normalizedPlatform}`;

    let clientId: string;

    if (userId) {
      // Use per-user credentials
      const creds = await this.getClientCredentials(userId, organizationId, normalizedPlatform);
      clientId = creds.clientId;
    } else {
      // Legacy fallback: env var only
      clientId =
        this.configService.get<string>(
          `${normalizedPlatform}_CLIENT_ID`,
        ) || 'PLACEHOLDER_CLIENT_ID';
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: config.scopes,
      state: organizationId,
    });

    const oauthUrl = `${config.authorizeUrl}?${params.toString()}`;

    this.logger.log(`OAuth URL for ${normalizedPlatform}:`);
    this.logger.log(`  client_id: ${clientId}`);
    this.logger.log(`  redirect_uri: ${redirectUri}`);
    this.logger.log(`  scopes: ${config.scopes}`);
    this.logger.log(`  Full URL: ${oauthUrl}`);

    return {
      url: oauthUrl,
      platform: normalizedPlatform,
    };
  }

  /**
   * Exchange OAuth code for token. Platform-specific implementations.
   */
  private async exchangeCodeForToken(
    platform: string,
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
  ): Promise<TokenExchangeResult> {
    switch (platform) {
      case 'FACEBOOK':
      case 'INSTAGRAM': {
        // Exchange code for short-lived token
        const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
        tokenUrl.searchParams.set('client_id', clientId);
        tokenUrl.searchParams.set('client_secret', clientSecret);
        tokenUrl.searchParams.set('redirect_uri', redirectUri);
        tokenUrl.searchParams.set('code', code);

        const tokenRes = await fetch(tokenUrl.toString());
        const tokenData = await tokenRes.json() as any;

        if (tokenData.error) {
          this.logger.error(`Facebook token exchange error: ${JSON.stringify(tokenData.error)}`);
          throw new BadRequestException(
            `Facebook auth failed: ${tokenData.error.message || 'Token exchange failed'}`,
          );
        }

        // Exchange short-lived token for long-lived token
        const longTokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
        longTokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
        longTokenUrl.searchParams.set('client_id', clientId);
        longTokenUrl.searchParams.set('client_secret', clientSecret);
        longTokenUrl.searchParams.set('fb_exchange_token', tokenData.access_token);

        const longTokenRes = await fetch(longTokenUrl.toString());
        const longTokenData = await longTokenRes.json() as any;

        const accessToken = longTokenData.access_token || tokenData.access_token;
        const expiresIn = longTokenData.expires_in || tokenData.expires_in || 5184000;

        // Get user profile
        const meRes = await fetch(
          `https://graph.facebook.com/v21.0/me?fields=id,name,picture&access_token=${accessToken}`,
        );
        const meData = await meRes.json() as any;

        return {
          accessToken,
          expiresIn,
          profileId: meData.id,
          profileName: meData.name,
          profilePicture: meData.picture?.data?.url,
        };
      }

      case 'LINKEDIN':
      case 'LINKEDIN_PAGE': {
        const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
          }),
        });
        const tokenData = await tokenRes.json() as any;

        if (tokenData.error) {
          throw new BadRequestException(
            `LinkedIn auth failed: ${tokenData.error_description || tokenData.error}`,
          );
        }

        return {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresIn: tokenData.expires_in,
        };
      }

      case 'TWITTER': {
        const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            code_verifier: 'challenge', // Simplified — production needs PKCE
          }),
        });
        const tokenData = await tokenRes.json() as any;

        if (tokenData.error) {
          throw new BadRequestException(
            `Twitter auth failed: ${tokenData.error_description || tokenData.error}`,
          );
        }

        return {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresIn: tokenData.expires_in,
        };
      }

      default: {
        // Generic OAuth2 authorization_code flow
        this.logger.warn(
          `No specific token exchange for ${platform}, using placeholder`,
        );
        return {
          accessToken: `pending_token_${code.substring(0, 16)}`,
          expiresIn: 3600,
        };
      }
    }
  }

  async handleOAuthCallback(
    organizationId: string,
    platform: string,
    code: string,
    userId?: string,
  ) {
    const normalizedPlatform = platform.toUpperCase();

    if (!code) {
      throw new BadRequestException('Authorization code is required');
    }

    this.logger.log(
      `OAuth callback for ${normalizedPlatform} with code: ${code.substring(0, 8)}...`,
    );

    // Get credentials for token exchange
    let clientId: string;
    let clientSecret: string;

    if (userId) {
      try {
        const creds = await this.getClientCredentials(userId, organizationId, normalizedPlatform);
        clientId = creds.clientId;
        clientSecret = creds.clientSecret || '';
        this.logger.log(`Using per-user credentials for ${normalizedPlatform} token exchange`);
      } catch {
        this.logger.warn(`No per-user credentials for ${normalizedPlatform}, using env fallback`);
        clientId = this.configService.get<string>(`${normalizedPlatform}_CLIENT_ID`) || '';
        clientSecret = this.configService.get<string>(`${normalizedPlatform}_CLIENT_SECRET`) || '';
      }
    } else {
      clientId = this.configService.get<string>(`${normalizedPlatform}_CLIENT_ID`) || '';
      clientSecret = this.configService.get<string>(`${normalizedPlatform}_CLIENT_SECRET`) || '';
    }

    const publicBaseUrl = this.getPublicBaseUrl();
    const redirectUri = `${publicBaseUrl}/api/integrations/callback/${normalizedPlatform}`;

    // Exchange the authorization code for an access token
    let tokenResult: TokenExchangeResult;
    try {
      tokenResult = await this.exchangeCodeForToken(
        normalizedPlatform,
        code,
        clientId,
        clientSecret,
        redirectUri,
      );
    } catch (err) {
      this.logger.error(`Token exchange failed for ${normalizedPlatform}: ${err}`);
      throw err instanceof BadRequestException
        ? err
        : new BadRequestException(`Failed to exchange authorization code for ${normalizedPlatform}`);
    }

    const integration = await this.prisma.integration.create({
      data: {
        organizationId,
        platform: normalizedPlatform as any,
        name: tokenResult.profileName || `${normalizedPlatform} Account`,
        profilePicture: tokenResult.profilePicture || null,
        internalId: tokenResult.profileId || `${normalizedPlatform.toLowerCase()}_${Date.now()}`,
        token: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken || null,
        tokenExpiration: tokenResult.expiresIn
          ? new Date(Date.now() + tokenResult.expiresIn * 1000)
          : new Date(Date.now() + 60 * 60 * 1000),
        metadata: {
          connectedVia: 'oauth',
          connectedAt: new Date().toISOString(),
          usedPerUserCredentials: !!userId,
        },
      },
      include: { platformProfile: true },
    });

    // Create a default platform profile
    await this.prisma.platformProfile.create({
      data: {
        integrationId: integration.id,
        organizationId,
        platform: normalizedPlatform as any,
        settings: {},
        preferredTimes: [540, 720, 1020], // 9am, 12pm, 5pm UTC
      },
    });

    return integration;
  }

  async update(
    organizationId: string,
    id: string,
    data: { name?: string; disabled?: boolean; metadata?: Record<string, any> },
  ) {
    const integration = await this.prisma.integration.findFirst({
      where: { id, organizationId },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.disabled !== undefined) updateData.disabled = data.disabled;
    if (data.metadata !== undefined) {
      // Merge with existing metadata
      updateData.metadata = {
        ...(integration.metadata as Record<string, any> || {}),
        ...data.metadata,
      };
    }

    return this.prisma.integration.update({
      where: { id },
      data: updateData,
      include: { platformProfile: true },
    });
  }

  async remove(organizationId: string, id: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id, organizationId },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    // Check for scheduled posts that depend on this integration
    const scheduledPosts = await this.prisma.post.count({
      where: {
        integrationId: id,
        state: { in: ['SCHEDULED', 'PUBLISHING'] },
      },
    });

    if (scheduledPosts > 0) {
      throw new BadRequestException(
        `Cannot remove integration with ${scheduledPosts} scheduled/publishing post(s). Cancel or reassign them first.`,
      );
    }

    await this.prisma.integration.delete({ where: { id } });
    return { success: true };
  }

  async updateProfile(
    organizationId: string,
    integrationId: string,
    data: { settings: Record<string, any>; preferredTimes?: number[] },
  ) {
    const integration = await this.prisma.integration.findFirst({
      where: { id: integrationId, organizationId },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    // Validate preferred times (0-1439 minutes from midnight)
    if (data.preferredTimes) {
      for (const time of data.preferredTimes) {
        if (time < 0 || time > 1439) {
          throw new BadRequestException(
            `Invalid preferred time: ${time}. Must be between 0 and 1439 (minutes from midnight).`,
          );
        }
      }
    }

    return this.prisma.platformProfile.upsert({
      where: { integrationId },
      create: {
        integrationId,
        organizationId,
        platform: integration.platform,
        settings: data.settings,
        preferredTimes: data.preferredTimes || [],
      },
      update: {
        settings: data.settings,
        ...(data.preferredTimes !== undefined && {
          preferredTimes: data.preferredTimes,
        }),
      },
    });
  }

  async getProfile(organizationId: string, integrationId: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id: integrationId, organizationId },
      select: { id: true, platform: true, name: true },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    const profile = await this.prisma.platformProfile.findFirst({
      where: { integrationId, organizationId },
    });

    return {
      integration,
      profile: profile || { settings: {}, preferredTimes: [] },
    };
  }
}
