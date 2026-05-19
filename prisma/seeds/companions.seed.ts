import { PrismaClient } from '@prisma/client';

export async function seedCompanions(prisma: PrismaClient) {
  const companions = [
    {
      slug: 'captain-blackvein',
      name: 'Captain Blackvein',
      description:
        'A relentless pirate commander who never loosens his grip on discipline.',
      image_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778402063/blackvien_knxeej.png',
    },

    {
      slug: 'tharok-warborn',
      name: 'Tharok Warborn',
      description:
        'A primal force forged through pain, struggle, and survival.',
      image_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778402117/Tharok_Warborn_nkxmm6.png',
    },

    {
      slug: 'arkan-veylor',
      name: 'Arkan Veylor',
      description:
        'A silent master who teaches control over urges, thoughts, and impulses—not through force, but through mastery.',
      image_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778402019/Arkan_Veylor_i5x54a.png',
    },

    {
      slug: 'seris-astraea',
      name: 'Seris Astraea',
      description:
        'A guardian of knowledge who sees beyond distraction and illusion.',
      image_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778402095/Seris_Astraea_ldziyr.png',
    },
  ];

  for (const companion of companions) {
    await prisma.companions.upsert({
      where: {
        slug: companion.slug,
      },
      update: {
        name: companion.name,
        description: companion.description,
        image_url: companion.image_url,
        created_at: new Date(),
      },
      create: companion,
    });
  }

  console.log(' Companions seeded');
}