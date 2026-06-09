import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { seedCompanions } from './seeds/companions.seed';
import { seedAvatars } from './seeds/avatars.seed';
import { seedActivities } from './seeds/activities.seed';
import { seedBooks } from './seeds/books.seed';
import { seedAchievements } from './seeds/achievements.seed';
import { seedAdmin } from './seeds/admin.seed';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set in .env');
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding started...');

  await seedCompanions(prisma);
  await seedAvatars(prisma);
  await seedActivities(prisma);
  await seedBooks(prisma);
  await seedAchievements(prisma);
  await seedAdmin(prisma);
  console.log('✅ Seeding completed');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });