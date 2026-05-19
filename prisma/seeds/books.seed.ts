import { PrismaClient } from '@prisma/client';

export async function seedBooks(prisma: PrismaClient) {
  const books = [
    {
      title: 'Atomic Habits',
      author: 'James Clear',
    },

    {
      title: 'Deep Work',
      author: 'Cal Newport',
    },

    {
      title: 'Can’t Hurt Me',
      author: 'David Goggins',
    },

    {
      title: 'The Psychology of Money',
      author: 'Morgan Housel',
    },

    {
      title: 'The 7 Habits of Highly Effective People',
      author: 'Stephen R. Covey',
    },

    {
      title: 'Rich Dad Poor Dad',
      author: 'Robert Kiyosaki',
    },

    {
      title: 'Think and Grow Rich',
      author: 'Napoleon Hill',
    },

    {
      title: 'The Power of Now',
      author: 'Eckhart Tolle',
    },

    {
      title: 'The Subtle Art of Not Giving a F*ck',
      author: 'Mark Manson',
    },

    {
      title: 'Ikigai',
      author: 'Héctor García & Francesc Miralles',
    },

    {
      title: 'The Secret',
      author: 'Rhonda Byrne',
    },

    {
      title: 'The Power of Your Subconscious Mind',
      author: 'Joseph Murphy',
    },

    {
      title: 'The Hard Thing About Hard Things',
      author: 'Ben Horowitz',
    },
  ];

  for (const book of books) {
    const existing = await prisma.books_catalog.findFirst({
      where: {
        title: book.title,
      },
    });

    if (!existing) {
      await prisma.books_catalog.create({
        data: {
          ...book,
          created_at: new Date(),
        },
      });
    }
  }

  console.log('✅ Books seeded');
}