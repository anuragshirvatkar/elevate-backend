import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SaveProgressDto } from './dto/save-progress.dto';
import { CompleteResponseDto } from './dto/complete-response.dto';
import { EditSetupDto } from './dto/setup.dto';
import { EditMindSetupDto } from './dto/mind-setup.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AchievementsService } from '../achievements/achievements.service';
import { AchievementSlugs } from '../achievements/triggers/achievement-slugs';
import { CompanionMessagesService } from '../companion-messages/companion-messages.service';
import { CompanionMessageType } from '../companion-messages/companion-message-types';
import { AchievementMessages } from '../companion-messages/templates/achievement.messages';
import { SetupOptionsResponseDto } from './dto/setup-options-response.dto';
import { SetupProgressResponseDto } from './dto/setup-progress-response.dto';

const ACTIVITY_SECTIONS = ['power', 'craft', 'mind', 'purity', 'consistency'] as const;
const ONBOARDING_SECTIONS = ['power', 'craft', 'mind'] as const;
const SETUP_SECTIONS = ['power', 'craft'] as const;

function formatTime(time: Date | null | undefined): string | null {
  if (!time) return null;
  const h = time.getUTCHours().toString().padStart(2, '0');
  const m = time.getUTCMinutes().toString().padStart(2, '0');
  const s = time.getUTCSeconds().toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function formatDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().substring(0, 10);
}

function parseRestDays(json: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(json)) return [];
  return json.filter((d): d is string => typeof d === 'string');
}

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  constructor(
    private prisma: PrismaService,
    private achievementsService: AchievementsService,
    private companionMessagesService: CompanionMessagesService,
  ) {}

  async getOptions(): Promise<SetupOptionsResponseDto> {
    const [companions, activities, books] = await Promise.all([
      this.prisma.companions.findMany({
        orderBy: { created_at: 'asc' },
        select: { id: true, name: true, description: true, image_url: true },
      }),
      this.prisma.activities.findMany({
        where: { user_id: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, section: true },
      }),
      this.prisma.books_catalog.findMany({
        orderBy: { title: 'asc' },
        select: { id: true, title: true, author: true, default_total_pages: true },
      }),
    ]);

    const groupedActivities = Object.fromEntries(
      ACTIVITY_SECTIONS.map((section) => [
        section,
        activities.filter((a) => a.section === section),
      ]),
    ) as Record<(typeof ACTIVITY_SECTIONS)[number], typeof activities>;

    return {
      companions: companions.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description ?? null,
        image: c.image_url ?? null,
      })),
      activities: groupedActivities,
      books: books.map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author ?? null,
        pages: b.default_total_pages ?? null,
      })),
    };
  }

  async getProgress(userId: string): Promise<SetupProgressResponseDto> {
    const [user, activeCompanion, setups] = await Promise.all([
      this.prisma.users.findUnique({
        where: { id: userId },
        select: { onboarding_completed: true, date_of_birth: true },
      }),
      this.prisma.user_companions.findFirst({
        where: { user_id: userId, is_active: true },
        include: {
          companion: {
            select: { id: true, name: true, description: true, image_url: true },
          },
        },
      }),
      this.prisma.user_setups.findMany({
        where: { user_id: userId, section: { in: [...ONBOARDING_SECTIONS] } },
        include: {
          user_setup_activities: {
            include: {
              activity: { select: { id: true, name: true, section: true } },
            },
          },
          user_setup_books: {
            include: {
              user_book: {
                select: {
                  id: true,
                  title: true,
                  book_catalog_id: true,
                  books_catalog: { select: { id: true, author: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    const setupBySection = Object.fromEntries(setups.map((s) => [s.section, s]));

    const buildActivitySection = (section: 'power' | 'craft') => {
      const setup = setupBySection[section];
      if (!setup) return { preferredTime: null, restDays: [], activities: [] };
      return {
        preferredTime: formatTime(setup.preferred_time),
        restDays: parseRestDays(setup.rest_days),
        activities: setup.user_setup_activities.map((usa) => ({
          id: usa.activity.id,
          name: usa.activity.name,
          section: usa.activity.section,
        })),
      };
    };

    const mindSetup = setupBySection['mind'];
    const mindSection = !mindSetup
      ? { preferredTime: null, restDays: [], books: [] }
      : {
          preferredTime: formatTime(mindSetup.preferred_time),
          restDays: parseRestDays(mindSetup.rest_days),
          books: mindSetup.user_setup_books.map((usb) => ({
            id: usb.user_book.books_catalog?.id ?? usb.user_book.id,
            title: usb.user_book.title,
            author: usb.user_book.books_catalog?.author ?? null,
          })),
        };

    return {
      onboardingCompleted: user?.onboarding_completed ?? false,
      dob: formatDate(user?.date_of_birth),
      selectedCompanion: activeCompanion
        ? {
            id: activeCompanion.companion.id,
            name: activeCompanion.companion.name,
            description: activeCompanion.companion.description ?? null,
            image: activeCompanion.companion.image_url ?? null,
          }
        : null,
      sections: {
        power: buildActivitySection('power'),
        craft: buildActivitySection('craft'),
        mind: mindSection,
      },
    };
  }

  async saveProgress(userId: string, dto: SaveProgressDto): Promise<SetupProgressResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      if (dto.dob !== undefined) {
        await tx.users.update({
          where: { id: userId },
          data: { date_of_birth: new Date(dto.dob) },
        });
      }

      if (dto.companionId !== undefined) {
        const companion = await tx.companions.findUnique({
          where: { id: dto.companionId },
        });
        if (!companion) {
          throw new BadRequestException(`Companion "${dto.companionId}" not found.`);
        }
        await tx.user_companions.updateMany({
          where: { user_id: userId },
          data: { is_active: false },
        });
        const existingLink = await tx.user_companions.findFirst({
          where: { user_id: userId, companion_id: dto.companionId },
        });
        if (existingLink) {
          await tx.user_companions.update({
            where: { id: existingLink.id },
            data: { is_active: true, selected_at: new Date() },
          });
        } else {
          await tx.user_companions.create({
            data: {
              user_id: userId,
              companion_id: dto.companionId,
              is_active: true,
              selected_at: new Date(),
            },
          });
        }
      }

      if (dto.sections) {
        for (const section of ['power', 'craft'] as const) {
          const sectionData = dto.sections[section];
          if (!sectionData) continue;

          const setupData: Prisma.user_setupsUpdateInput = {};
          const setupCreateData: Prisma.user_setupsCreateInput = {
            user: { connect: { id: userId } },
            section,
          };

          if (sectionData.preferredTime !== undefined) {
            const t = new Date(`1970-01-01T${sectionData.preferredTime}Z`);
            setupData.preferred_time = t;
            setupCreateData.preferred_time = t;
          }
          if (sectionData.restDays !== undefined) {
            setupData.rest_days = sectionData.restDays;
            setupCreateData.rest_days = sectionData.restDays;
          }

          const setup = await tx.user_setups.upsert({
            where: { user_id_section: { user_id: userId, section } },
            create: setupCreateData as Parameters<typeof tx.user_setups.create>[0]['data'],
            update: setupData,
          });

          if (sectionData.activityIds !== undefined) {
            if (sectionData.activityIds.length > 0) {
              const valid = await tx.activities.findMany({
                where: {
                  id: { in: sectionData.activityIds },
                  OR: [{ user_id: null }, { user_id: userId }],
                },
                select: { id: true },
              });
              if (valid.length !== sectionData.activityIds.length) {
                throw new BadRequestException(
                  'One or more activityIds are invalid or do not belong to this user.',
                );
              }
            }
            await tx.user_setup_activities.deleteMany({
              where: { user_setup_id: setup.id },
            });
            if (sectionData.activityIds.length > 0) {
              await tx.user_setup_activities.createMany({
                data: sectionData.activityIds.map((activityId) => ({
                  user_setup_id: setup.id,
                  activity_id: activityId,
                })),
              });
            }
          }
        }

        const mindData = dto.sections.mind;
        if (mindData) {
          if (mindData.skipMind === true) {
            await tx.user_setups.upsert({
              where: { user_id_section: { user_id: userId, section: 'mind' } },
              create: {
                user: { connect: { id: userId } },
                section: 'mind',
                is_active: false,
              } as Parameters<typeof tx.user_setups.create>[0]['data'],
              update: { is_active: false },
            });

            const existingMindSkipped = await tx.user_companion_messages.findFirst({
              where: {
                user_id: userId,
                type: CompanionMessageType.MIND_SKIPPED,
              },
            });

            if (!existingMindSkipped) {
              await this.companionMessagesService.createMessage({
                userId,
                type: CompanionMessageType.MIND_SKIPPED,
                companionName: 'Riven',
                title: 'Mind Paused',
                message: 'No problem. We will leave the shelves untouched for now.',
              });
            }
          } else {
            const mindSetupData: Prisma.user_setupsUpdateInput = { is_active: true };
            const mindCreateData: Prisma.user_setupsCreateInput = {
              user: { connect: { id: userId } },
              section: 'mind',
              is_active: true,
            };

            if (mindData.preferredTime !== undefined) {
              const t = new Date(`1970-01-01T${mindData.preferredTime}Z`);
              mindSetupData.preferred_time = t;
              mindCreateData.preferred_time = t;
            }
            if (mindData.restDays !== undefined) {
              mindSetupData.rest_days = mindData.restDays;
              mindCreateData.rest_days = mindData.restDays;
            }

            const mindSetup = await tx.user_setups.upsert({
              where: { user_id_section: { user_id: userId, section: 'mind' } },
              create: mindCreateData as Parameters<typeof tx.user_setups.create>[0]['data'],
              update: mindSetupData,
            });

            if (mindData.bookIds !== undefined) {
              if (mindData.bookIds.length > 0) {
                const validCatalogs = await tx.books_catalog.findMany({
                  where: { id: { in: mindData.bookIds } },
                });
                if (validCatalogs.length !== mindData.bookIds.length) {
                  throw new BadRequestException(
                    'One or more bookIds are invalid.',
                  );
                }

                const userBookIds: string[] = [];
                for (const catalogId of mindData.bookIds) {
                  const catalog = validCatalogs.find((c) => c.id === catalogId)!;
                  let userBook = await tx.user_books.findFirst({
                    where: { user_id: userId, book_catalog_id: catalogId },
                  });
                  if (!userBook) {
                    userBook = await tx.user_books.create({
                      data: {
                        user_id: userId,
                        book_catalog_id: catalogId,
                        title: catalog.title,
                        total_pages: catalog.default_total_pages ?? 0,
                      },
                    });
                  }
                  userBookIds.push(userBook.id);
                }

                await tx.user_setup_books.deleteMany({
                  where: { user_setup_id: mindSetup.id },
                });
                await tx.user_setup_books.createMany({
                  data: userBookIds.map((userBookId) => ({
                    user_setup_id: mindSetup.id,
                    user_book_id: userBookId,
                  })),
                });
              } else {
                await tx.user_setup_books.deleteMany({
                  where: { user_setup_id: mindSetup.id },
                });
              }
            }
          }
        }
      }
    });

    return this.getProgress(userId);
  }

  async completeOnboarding(userId: string): Promise<CompleteResponseDto> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { onboarding_completed: true, date_of_birth: true },
    });

    if (user?.onboarding_completed) {
      return { success: true, message: 'Onboarding completed successfully' };
    }

    if (!user?.date_of_birth) {
      throw new BadRequestException('Date of birth is required to complete onboarding.');
    }

    const [companion, powerSetup, craftSetup, mindSetup] = await Promise.all([
      this.prisma.user_companions.findFirst({
        where: { user_id: userId, is_active: true },
      }),
      this.prisma.user_setups.findUnique({
        where: { user_id_section: { user_id: userId, section: 'power' } },
        include: { _count: { select: { user_setup_activities: true } } },
      }),
      this.prisma.user_setups.findUnique({
        where: { user_id_section: { user_id: userId, section: 'craft' } },
        include: { _count: { select: { user_setup_activities: true } } },
      }),
      this.prisma.user_setups.findUnique({
        where: { user_id_section: { user_id: userId, section: 'mind' } },
        include: { _count: { select: { user_setup_books: true } } },
      }),
    ]);

    if (!companion) {
      throw new BadRequestException('A companion must be selected to complete onboarding.');
    }
    if (!powerSetup || powerSetup._count.user_setup_activities < 1) {
      throw new BadRequestException('At least one power activity must be selected.');
    }
    if (!craftSetup || craftSetup._count.user_setup_activities < 1) {
      throw new BadRequestException('At least one craft activity must be selected.');
    }
    if (!mindSetup) {
      throw new BadRequestException('Mind setup must be completed or skipped.');
    }
    if (mindSetup.is_active && mindSetup._count.user_setup_books < 1) {
      throw new BadRequestException('At least one mind book must be selected when Mind is active.');
    }

    await this.prisma.users.update({
      where: { id: userId },
      data: { onboarding_completed: true, updated_at: new Date() },
    });

    const newJourneyAchievement = await this.achievementsService.unlockAchievementBySlug(
      userId,
      AchievementSlugs.NEW_JOURNEY_BEGINS,
    );

    let achievementId = newJourneyAchievement?.id;
    let iconUrl = newJourneyAchievement?.iconUrl;

    if (!achievementId) {
      const achievement = await this.prisma.achievements.findUnique({
        where: { slug: AchievementSlugs.NEW_JOURNEY_BEGINS },
        select: { id: true, icon_url: true },
      });
      achievementId = achievement?.id;
      iconUrl = achievement?.icon_url;
    }

    await this.companionMessagesService.createMessage({
      userId,
      type: AchievementMessages.NEW_JOURNEY_BEGINS.type,
      companionName: 'Riven',
      title: AchievementMessages.NEW_JOURNEY_BEGINS.title,
      message: AchievementMessages.NEW_JOURNEY_BEGINS.message,
      entityType: 'achievement',
      entityId: achievementId,
      action: 'open_achievement',
      metadata: iconUrl ? { imageUrl: iconUrl } : undefined,
    });

    return { success: true, message: 'Onboarding completed successfully' };
  }

  async getSetup(userId: string, section: string) {
    if (!SETUP_SECTIONS.includes(section as (typeof SETUP_SECTIONS)[number])) {
      throw new BadRequestException({ success: false, message: 'Invalid section' });
    }

    const setup = await this.prisma.user_setups.findUnique({
      where: { user_id_section: { user_id: userId, section } },
      include: {
        user_setup_activities: {
          include: {
            activity: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!setup) {
      return {
        section,
        preferredTime: null,
        restDays: [],
        activities: [],
      };
    }

    return {
      section,
      preferredTime: formatTime(setup.preferred_time),
      restDays: parseRestDays(setup.rest_days),
      activities: setup.user_setup_activities.map((usa) => ({
        activityId: usa.activity.id,
        name: usa.activity.name,
        isPrimary: usa.is_primary,
      })),
    };
  }

  async editSetup(userId: string, section: string, dto: EditSetupDto) {
    if (!SETUP_SECTIONS.includes(section as (typeof SETUP_SECTIONS)[number])) {
      throw new BadRequestException({ success: false, message: 'Invalid section' });
    }

    const { activities } = dto;

    if (!activities || activities.length === 0) {
      throw new BadRequestException({ success: false, message: 'At least one activity is required' });
    }

    const primaryCount = activities.filter((a) => a.isPrimary).length;
    if (primaryCount > 1) {
      throw new BadRequestException({ success: false, message: 'Only one primary activity allowed' });
    }

    const activityIds = activities.map((a) => a.activityId);
    const validActivities = await this.prisma.activities.findMany({
      where: {
        id: { in: activityIds },
        section: section,
        OR: [{ user_id: null }, { user_id: userId }],
      },
      select: { id: true, name: true },
    });

    if (validActivities.length !== activityIds.length) {
      throw new BadRequestException({ success: false, message: 'Invalid activity ownership or wrong section' });
    }

    let primaryIndex = activities.findIndex((a) => a.isPrimary);
    if (primaryIndex === -1) {
      primaryIndex = 0;
    }

    const setupActivities = activities.map((a, idx) => ({
      activity_id: a.activityId,
      is_primary: idx === primaryIndex,
    }));

    const result = await this.prisma.$transaction(async (tx) => {
      const setup = await tx.user_setups.upsert({
        where: { user_id_section: { user_id: userId, section } },
        create: {
          user_id: userId,
          section,
          preferred_time: dto.preferredTime ? new Date(`1970-01-01T${dto.preferredTime}Z`) : null,
          rest_days: dto.restDays ?? [],
        },
        update: {
          preferred_time: dto.preferredTime ? new Date(`1970-01-01T${dto.preferredTime}Z`) : undefined,
          rest_days: dto.restDays ?? undefined,
        },
      });

      await tx.user_setup_activities.deleteMany({
        where: { user_setup_id: setup.id },
      });

      if (setupActivities.length > 0) {
        await tx.user_setup_activities.createMany({
          data: setupActivities.map((sa) => ({
            user_setup_id: setup.id,
            activity_id: sa.activity_id,
            is_primary: sa.is_primary,
          })),
        });
      }

      const updatedSetup = await tx.user_setups.findUnique({
        where: { id: setup.id },
        include: {
          user_setup_activities: {
            include: {
              activity: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });

      return updatedSetup;
    });

    this.logger.log(`Setup updated: userId=${userId} section=${section}`);

    return {
      success: true,
      section,
      preferredTime: formatTime(result!.preferred_time),
      restDays: parseRestDays(result!.rest_days),
      activities: result!.user_setup_activities.map((usa) => ({
        activityId: usa.activity.id,
        name: usa.activity.name,
        isPrimary: usa.is_primary,
      })),
    };
  }

  async getMindSetup(userId: string) {
    const setup = await this.prisma.user_setups.findUnique({
      where: { user_id_section: { user_id: userId, section: 'mind' } },
      include: {
        user_setup_books: {
          include: {
            user_book: {
              include: {
                books_catalog: {
                  select: { author: true },
                },
              },
            },
          },
        },
      },
    });

    if (!setup) {
      return {
        section: 'mind',
        isActive: true,
        preferredTime: null,
        restDays: [],
        books: [],
      };
    }

    return {
      section: 'mind',
      isActive: setup.is_active ?? true,
      preferredTime: formatTime(setup.preferred_time),
      restDays: parseRestDays(setup.rest_days),
      books: setup.user_setup_books.map((usb) => ({
        userBookId: usb.user_book.id,
        title: usb.user_book.title,
        author: usb.user_book.books_catalog?.author ?? null,
        currentPage: usb.user_book.current_page,
        totalPages: usb.user_book.total_pages,
        isCompleted: usb.user_book.is_completed,
        completedAt: usb.user_book.completed_at ? usb.user_book.completed_at.toISOString().slice(0, 10) : null,
        aiSummary: (usb.user_book as any).ai_summary ?? null,
      })),
    };
  }

  async editMindSetup(userId: string, dto: EditMindSetupDto) {
    const { books, isActive } = dto;

    const activating = isActive === true;
    const deactivating = isActive === false;

    if (activating && (!books || books.length === 0)) {
      throw new BadRequestException({ success: false, message: 'At least one book is required when activating Mind' });
    }

    if (books && books.length > 0) {
      const bookIds = books.map((b) => b.userBookId);
      const validBooks = await this.prisma.user_books.findMany({
        where: { id: { in: bookIds }, user_id: userId },
        select: { id: true },
      });
      if (validBooks.length !== bookIds.length) {
        throw new BadRequestException({ success: false, message: 'Invalid book ownership' });
      }
    }

    const existingSetup = await this.prisma.user_setups.findUnique({
      where: { user_id_section: { user_id: userId, section: 'mind' } },
      select: { is_active: true },
    });
    const previouslyActive = existingSetup?.is_active ?? true;

    const result = await this.prisma.$transaction(async (tx) => {
      const setup = await tx.user_setups.upsert({
        where: { user_id_section: { user_id: userId, section: 'mind' } },
        create: {
          user_id: userId,
          section: 'mind',
          is_active: isActive ?? true,
          preferred_time: dto.preferredTime ? new Date(`1970-01-01T${dto.preferredTime}Z`) : null,
          rest_days: dto.restDays ?? [],
        },
        update: {
          ...(isActive !== undefined ? { is_active: isActive } : {}),
          preferred_time: dto.preferredTime ? new Date(`1970-01-01T${dto.preferredTime}Z`) : undefined,
          rest_days: dto.restDays ?? undefined,
        },
      });

      if (books && books.length > 0) {
        await tx.user_setup_books.deleteMany({ where: { user_setup_id: setup.id } });
        await tx.user_setup_books.createMany({
          data: books.map((b) => ({ user_setup_id: setup.id, user_book_id: b.userBookId })),
        });

        for (const book of books) {
          if (book.isCompleted) {
            await tx.user_books.update({
              where: { id: book.userBookId },
              data: { is_completed: true, completed_at: new Date() },
            });
          }
        }
      } else if (deactivating) {
        await tx.user_setup_books.deleteMany({ where: { user_setup_id: setup.id } });
      }

      const updatedSetup = await tx.user_setups.findUnique({
        where: { id: setup.id },
        include: {
          user_setup_books: {
            include: {
              user_book: {
                include: { books_catalog: { select: { author: true } } },
              },
            },
          },
        },
      });

      return updatedSetup;
    });

    if (activating && !previouslyActive) {
      await this.companionMessagesService.createMessage({
        userId,
        type: CompanionMessageType.MIND_ACTIVATED,
        companionName: 'Riven',
        title: 'Mind Awakened',
        message: 'You opened the gate again. Knowledge begins moving once more.',
      });
    } else if (deactivating && previouslyActive) {
      await this.companionMessagesService.createMessage({
        userId,
        type: CompanionMessageType.MIND_PAUSED,
        companionName: 'Riven',
        title: 'Mind Paused',
        message: 'The books can rest for now. The path remains here when you return.',
      });
    }

    this.logger.log(`Mind setup updated: userId=${userId}`);

    return {
      success: true,
      section: 'mind',
      isActive: result!.is_active ?? true,
      preferredTime: formatTime(result!.preferred_time),
      restDays: parseRestDays(result!.rest_days),
      books: result!.user_setup_books.map((usb) => ({
        userBookId: usb.user_book.id,
        title: usb.user_book.title,
        author: usb.user_book.books_catalog?.author ?? null,
        currentPage: usb.user_book.current_page,
        totalPages: usb.user_book.total_pages,
        isCompleted: usb.user_book.is_completed,
        completedAt: usb.user_book.completed_at ? usb.user_book.completed_at.toISOString().slice(0, 10) : null,
        aiSummary: (usb.user_book as any).ai_summary ?? null,
      })),
    };
  }
}
