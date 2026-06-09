import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';

export async function seedAdmin(prisma: PrismaClient) {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn('⚠️  ADMIN_EMAIL or ADMIN_PASSWORD not set, skipping admin seed.');
    return;
  }

  const existing = await prisma.admins.findUnique({ where: { email } });

  if (existing) {
    console.log('Admin already exists, skipping...');
    return;
  }

  const password_hash = hashSync(password, 12);

  await prisma.admins.create({
    data: { email, password_hash },
  });

  console.log(`✅ Admin seeded: ${email}`);
}
