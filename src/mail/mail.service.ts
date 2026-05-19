import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private resend: Resend;

  constructor(private configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  async sendOtpEmail(to: string, otp: string): Promise<void> {
    const from = this.configService.get<string>('MAIL_FROM', 'Elevate <noreply@elevate.app>');

    await this.resend.emails.send({
      from,
      to,
      subject: `${otp} is your Elevate verification code`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h2 style="margin-bottom:8px;">Your verification code</h2>
          <p style="color:#555;margin-bottom:24px;">Use the code below to sign in to Elevate. It expires in 10 minutes.</p>
          <div style="font-size:40px;font-weight:700;letter-spacing:8px;padding:24px;background:#f4f4f5;border-radius:8px;text-align:center;">
            ${otp}
          </div>
          <p style="color:#888;font-size:13px;margin-top:24px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
  }
}
