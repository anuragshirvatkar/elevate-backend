import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EditProfileDto } from './dto/edit-profile.dto';

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

@Injectable()
export class EditProfileService {
  private readonly logger = new Logger(EditProfileService.name);

  constructor(private readonly prisma: PrismaService) {}

  async validateUsername(
    requesterId: string,
    username: string,
  ): Promise<{ isValid: boolean; reason: string | null }> {
    if (username.length < 3) return { isValid: false, reason: 'Minimum length is 3' };
    if (username.length > 50) return { isValid: false, reason: 'Maximum length is 50' };
    if (!USERNAME_REGEX.test(username)) {
      return { isValid: false, reason: 'Only letters, numbers, and underscores are allowed' };
    }

    const existing = await this.prisma.users.findFirst({
      where: { username, NOT: { id: requesterId } },
      select: { id: true },
    });
    if (existing) return { isValid: false, reason: 'Username already exists' };

    return { isValid: true, reason: null };
  }

  async editProfile(
    userId: string,
    dto: EditProfileDto,
  ): Promise<{ success: boolean; updatedFields: string[] }> {
    const currentUser = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    if (!currentUser) throw new NotFoundException('User not found');

    if (dto.username !== undefined) {
      if (dto.username.length < 3) throw new BadRequestException('Minimum length is 3');
      if (dto.username.length > 50) throw new BadRequestException('Maximum length is 50');
      if (!USERNAME_REGEX.test(dto.username)) {
        throw new BadRequestException('Only letters, numbers, and underscores are allowed');
      }
      if (dto.username !== currentUser.username) {
        const taken = await this.prisma.users.findFirst({
          where: { username: dto.username, NOT: { id: userId } },
          select: { id: true },
        });
        if (taken) throw new BadRequestException('Username already exists');
      }
    }

    if (dto.dateOfBirth !== undefined) {
      if (new Date(dto.dateOfBirth) > new Date()) {
        throw new BadRequestException('Date of birth cannot be in the future');
      }
    }

    const { updatedFields, newCompanionName, previousCompanionName, newAvatarName } =
      await this.prisma.$transaction(async (tx) => {
        const fields: string[] = [];

        const userUpdates: { username?: string; date_of_birth?: Date } = {};
        if (dto.username !== undefined) {
          userUpdates.username = dto.username;
          fields.push('username');
        }
        if (dto.dateOfBirth !== undefined) {
          userUpdates.date_of_birth = new Date(dto.dateOfBirth);
          fields.push('dateOfBirth');
        }
        if (Object.keys(userUpdates).length > 0) {
          await tx.users.update({ where: { id: userId }, data: userUpdates });
        }

        if (dto.socialLinks !== undefined) {
          await tx.user_social_links.deleteMany({ where: { user_id: userId } });
          if (dto.socialLinks.length > 0) {
            await tx.user_social_links.createMany({
              data: dto.socialLinks.map((l) => ({
                user_id: userId,
                platform: l.platform,
                url: l.url,
              })),
            });
          }
          fields.push('socialLinks');
        }

        let prevCompanionName: string | null = null;
        let newCmpName: string | null = null;
        if (dto.companionId !== undefined) {
          const prevActive = await tx.user_companions.findFirst({
            where: { user_id: userId, is_active: true },
            include: { companion: { select: { name: true } } },
          });
          prevCompanionName = prevActive?.companion.name ?? null;

          const target = await tx.user_companions.findFirst({
            where: { user_id: userId, companion_id: dto.companionId },
            include: { companion: { select: { name: true } } },
          });
          if (!target) throw new NotFoundException('Companion not found for this user');
          newCmpName = target.companion.name;

          await tx.user_companions.updateMany({
            where: { user_id: userId },
            data: { is_active: false },
          });
          await tx.user_companions.update({
            where: { id: target.id },
            data: { is_active: true, selected_at: new Date() },
          });
          fields.push('companion');
        }

        let newAvName: string | null = null;
        if (dto.avatarId !== undefined) {
          const ua = await tx.user_avatars.findUnique({
            where: { user_id_avatar_id: { user_id: userId, avatar_id: dto.avatarId } },
            include: { avatar: { select: { name: true } } },
          });
          if (!ua || !ua.is_unlocked) throw new BadRequestException('Avatar is not unlocked');
          newAvName = ua.avatar.name;

          await tx.user_avatars.updateMany({
            where: { user_id: userId },
            data: { is_selected: false },
          });
          await tx.user_avatars.update({
            where: { user_id_avatar_id: { user_id: userId, avatar_id: dto.avatarId } },
            data: { is_selected: true },
          });
          fields.push('avatar');
        }

        if (fields.length > 0) {
          await tx.user_profile_edits.create({
            data: { user_id: userId, edited_fields: fields },
          });
        }

        return {
          updatedFields: fields,
          newCompanionName: newCmpName,
          previousCompanionName: prevCompanionName,
          newAvatarName: newAvName,
        };
      });

    if (newCompanionName) {
      const msg = previousCompanionName
        ? `You decided to let ${previousCompanionName} rest. I'll walk beside you from here.`
        : `I'll walk beside you from here.`;
      await this.prisma.user_companion_messages.create({
        data: {
          user_id: userId,
          type: 'SYSTEM',
          companion_name: newCompanionName,
          title: 'New Guide',
          message: msg,
        },
      });
    }

    if (newAvatarName) {
      const active = await this.prisma.user_companions.findFirst({
        where: { user_id: userId, is_active: true },
        include: { companion: { select: { name: true } } },
      });
      const companionName = active?.companion.name ?? 'Your companion';
      await this.prisma.user_companion_messages.create({
        data: {
          user_id: userId,
          type: 'AVATAR_SELECTED',
          companion_name: companionName,
          title: 'Avatar Selected',
          message: `Great choice. ${newAvatarName} now carries your identity.`,
        },
      });
    }

    this.logger.log(`Profile edited: userId=${userId} fields=[${updatedFields.join(',')}]`);

    return { success: true, updatedFields };
  }
}
