import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

const FEMALE_EMAIL = (process.argv[2] ?? 'divyas3404@gmail.com').trim().toLowerCase();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const femaleUser = await prisma.users.findFirst({
    where: { email: { equals: FEMALE_EMAIL, mode: 'insensitive' } },
    select: { id: true, email: true, gender: true },
  });

  const maleResult = await prisma.users.updateMany({
    where: {
      OR: [
        { email: null },
        { email: { not: { equals: FEMALE_EMAIL, mode: 'insensitive' } } },
      ],
    },
    data: { gender: 'male', updated_at: new Date() },
  });

  console.log(`Set gender=male on ${maleResult.count} user(s)`);

  if (!femaleUser) {
    console.warn(`User not found for female email: ${FEMALE_EMAIL}`);
    return;
  }

  await prisma.users.update({
    where: { id: femaleUser.id },
    data: { gender: 'female', updated_at: new Date() },
  });

  console.log(`Set gender=female for ${femaleUser.email} (was: ${femaleUser.gender ?? 'null'})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
