import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const email = process.argv[2] ?? 'anuragshirvatkar1@gmail.com';
  const titleQuery = process.argv[3] ?? 'Atomic';

  const user = await prisma.users.findFirst({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) {
    console.log('User not found');
    return;
  }

  const books = await prisma.user_books.findMany({
    where: {
      user_id: user.id,
      title: { contains: titleQuery, mode: 'insensitive' },
    },
    select: { id: true, title: true, ai_summary: true, summary_pdf_url: true },
  });

  console.log('Before:', books);

  for (const book of books) {
    await prisma.user_books.update({
      where: { id: book.id },
      data: {
        ai_summary: null,
        summary_pdf_url: null,
        updated_at: new Date(),
      },
    });
  }

  console.log(`Cleared summary for ${books.length} book(s)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
