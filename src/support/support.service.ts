import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';
import { CreateSupportTicketDto } from './dto/support.dto';

const ALLOWED_ISSUE_TYPES = ['bug', 'feature_request', 'feedback', 'payment', 'account', 'other'] as const;
const ALLOWED_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
const ALLOWED_IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'webp'] as const;

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
  ) {}

  async uploadImages(files: Express.Multer.File[]): Promise<{ success: boolean; urls: string[] }> {
    this.logger.log(`DEBUG: Files received: ${files.length}`);
    if (files.length > 0) {
      this.logger.log(`DEBUG: First file - size: ${files[0].size}, mimetype: ${files[0].mimetype}, buffer length: ${files[0].buffer?.length ?? 0}`);
    }

    if (files.length === 0) {
      throw new BadRequestException({ success: false, message: 'No images provided' });
    }

    if (files.length > 5) {
      throw new BadRequestException({ success: false, message: 'Maximum 5 images allowed' });
    }

    const urls: string[] = [];

    for (const file of files) {
      const ext = file.mimetype.split('/')[1];
      if (!ALLOWED_IMAGE_TYPES.includes(ext as any)) {
        throw new BadRequestException({ success: false, message: 'Invalid file type' });
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new BadRequestException({ success: false, message: 'Maximum file size is 10MB' });
      }

      const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      const result = await this.cloudinaryService.uploadFile(base64, 'support');
      urls.push(result.secure_url);
    }

    this.logger.log(`Image upload: count=${files.length}`);

    return { success: true, urls };
  }

  async createTicket(userId: string, dto: CreateSupportTicketDto) {
    const { issueType, title, description, images } = dto;

    if (!ALLOWED_ISSUE_TYPES.includes(issueType as any)) {
      throw new BadRequestException({ success: false, message: 'Invalid issue type' });
    }

    if (title && title.length > 150) {
      throw new BadRequestException({ success: false, message: 'Title must be at most 150 characters' });
    }

    if (!description || description.length < 10) {
      throw new BadRequestException({ success: false, message: 'Description must be at least 10 characters' });
    }

    if (description.length > 5000) {
      throw new BadRequestException({ success: false, message: 'Description must be at most 5000 characters' });
    }

    if (images && images.length > 5) {
      throw new BadRequestException({ success: false, message: 'Maximum 5 images allowed' });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.support_tickets.create({
        data: {
          user_id: userId,
          issue_type: issueType,
          title,
          description,
          status: 'open',
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      if (images && images.length > 0) {
        await tx.support_ticket_images.createMany({
          data: images.map((imageUrl) => ({
            ticket_id: ticket.id,
            image_url: imageUrl,
            created_at: new Date(),
          })),
        });
      }

      return ticket;
    });

    this.logger.log(`Support ticket created: userId=${userId} ticketId=${result.id} issueType=${issueType}`);

    return {
      success: true,
      ticket: {
        id: result.id,
        issueType: result.issue_type,
        title: result.title,
        status: result.status,
        createdAt: result.created_at?.toISOString() ?? '',
      },
    };
  }

  async getTickets(userId: string, status?: string, issueType?: string) {
    if (status && !ALLOWED_STATUSES.includes(status as any)) {
      throw new BadRequestException({ success: false, message: 'Invalid status' });
    }

    if (issueType && !ALLOWED_ISSUE_TYPES.includes(issueType as any)) {
      throw new BadRequestException({ success: false, message: 'Invalid issue type' });
    }

    const where: any = {
      user_id: userId,
    };

    if (status) {
      where.status = status;
    }

    if (issueType) {
      where.issue_type = issueType;
    }

    const tickets = await this.prisma.support_tickets.findMany({
      where,
      include: {
        support_ticket_images: {
          select: {
            id: true,
            image_url: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    this.logger.log(`Support tickets fetched: userId=${userId} filters={status, issueType}`);

    return {
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        issueType: ticket.issue_type,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        images: ticket.support_ticket_images.map((img) => ({
          id: img.id,
          imageUrl: img.image_url,
        })),
        createdAt: ticket.created_at?.toISOString() ?? '',
        updatedAt: ticket.updated_at?.toISOString() ?? '',
      })),
    };
  }
}
