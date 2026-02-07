import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database.module';

/**
 * Masks string values in a JSON object by replacing all but the last 4 characters
 * with asterisks. Values with 4 or fewer characters are left unchanged.
 */
function maskCredentials(
  credentials: Record<string, any>,
): Record<string, any> {
  const masked: Record<string, any> = {};
  for (const [key, value] of Object.entries(credentials)) {
    if (typeof value === 'string' && value.length > 4) {
      const visiblePart = value.slice(-4);
      const maskedPart = '*'.repeat(value.length - 4);
      masked[key] = maskedPart + visiblePart;
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

@Injectable()
export class PlatformCredentialsService {
  private readonly logger = new Logger(PlatformCredentialsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, organizationId: string) {
    const credentials = await this.prisma.userPlatformCredential.findMany({
      where: { userId, organizationId },
      orderBy: { createdAt: 'desc' },
    });

    // Return as a Record<platform, data> for easy frontend consumption
    const result: Record<string, any> = {};
    for (const cred of credentials) {
      result[cred.platform] = {
        credentials: maskCredentials(
          cred.credentials as Record<string, any>,
        ),
        label: cred.label || '',
        isActive: cred.isActive,
      };
    }
    return result;
  }

  async getByPlatform(
    userId: string,
    organizationId: string,
    platform: string,
  ) {
    const normalizedPlatform = platform.toUpperCase();

    const credential = await this.prisma.userPlatformCredential.findFirst({
      where: { userId, organizationId, platform: normalizedPlatform as any },
    });

    if (!credential) {
      throw new NotFoundException(
        `No credentials found for platform ${normalizedPlatform}`,
      );
    }

    return {
      ...credential,
      credentials: maskCredentials(
        credential.credentials as Record<string, any>,
      ),
    };
  }

  async getRawByPlatform(
    userId: string,
    organizationId: string,
    platform: string,
  ) {
    const normalizedPlatform = platform.toUpperCase();

    const credential = await this.prisma.userPlatformCredential.findFirst({
      where: { userId, organizationId, platform: normalizedPlatform as any },
    });

    if (!credential) {
      throw new NotFoundException(
        `No credentials found for platform ${normalizedPlatform}`,
      );
    }

    return credential;
  }

  async upsert(
    userId: string,
    organizationId: string,
    platform: string,
    data: {
      credentials: Record<string, any>;
      label?: string;
      isActive?: boolean;
    },
  ) {
    const normalizedPlatform = platform.toUpperCase();

    const existing = await this.prisma.userPlatformCredential.findFirst({
      where: { userId, organizationId, platform: normalizedPlatform as any },
    });

    if (existing) {
      const updated = await this.prisma.userPlatformCredential.update({
        where: { id: existing.id },
        data: {
          credentials: data.credentials,
          ...(data.label !== undefined && { label: data.label }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      this.logger.log(
        `Updated credentials for platform ${normalizedPlatform} (user: ${userId})`,
      );

      return {
        ...updated,
        credentials: maskCredentials(
          updated.credentials as Record<string, any>,
        ),
      };
    }

    const created = await this.prisma.userPlatformCredential.create({
      data: {
        userId,
        organizationId,
        platform: normalizedPlatform as any,
        credentials: data.credentials,
        label: data.label,
        isActive: data.isActive ?? true,
      },
    });

    this.logger.log(
      `Created credentials for platform ${normalizedPlatform} (user: ${userId})`,
    );

    return {
      ...created,
      credentials: maskCredentials(
        created.credentials as Record<string, any>,
      ),
    };
  }

  async remove(userId: string, organizationId: string, platform: string) {
    const normalizedPlatform = platform.toUpperCase();

    const credential = await this.prisma.userPlatformCredential.findFirst({
      where: { userId, organizationId, platform: normalizedPlatform as any },
    });

    if (!credential) {
      throw new NotFoundException(
        `No credentials found for platform ${normalizedPlatform}`,
      );
    }

    await this.prisma.userPlatformCredential.delete({
      where: { id: credential.id },
    });

    this.logger.log(
      `Removed credentials for platform ${normalizedPlatform} (user: ${userId})`,
    );

    return { success: true };
  }

  async testCredentials(
    userId: string,
    organizationId: string,
    platform: string,
  ) {
    const normalizedPlatform = platform.toUpperCase();

    const credential = await this.prisma.userPlatformCredential.findFirst({
      where: { userId, organizationId, platform: normalizedPlatform as any },
    });

    if (!credential) {
      throw new NotFoundException(
        `No credentials found for platform ${normalizedPlatform}`,
      );
    }

    // Placeholder: in production this would call the platform's API
    // to verify the credentials are valid.
    return { success: true, message: 'Credentials validated' };
  }
}
