import { PrismaClient } from '@prisma/client';

export async function seedActivities(prisma: PrismaClient) {
  const activities = [
    { name: 'Gym', section: 'power' },
    { name: 'Running', section: 'power' },
    { name: 'Walking', section: 'power' },
    { name: 'Cycling', section: 'power' },
    { name: 'Swimming', section: 'power' },

    { name: 'Football', section: 'power' },
    { name: 'Basketball', section: 'power' },
    { name: 'Cricket Practice', section: 'power' },
    { name: 'Tennis', section: 'power' },
    { name: 'Badminton', section: 'power' },

    { name: 'Pickleball', section: 'power' },
    { name: 'Boat Rowing', section: 'power' },
    { name: 'Martial Arts', section: 'power' },
    { name: 'Boxing', section: 'power' },
    { name: 'Hiking', section: 'power' },

    { name: 'Yoga', section: 'power' },
    { name: 'Calisthenics', section: 'power' },
    { name: 'Skipping Rope', section: 'power' },
    { name: 'Push-ups', section: 'power' },
    { name: 'Pull-ups', section: 'power' },

    { name: 'Dance Training', section: 'power' },
    { name: 'Meditation', section: 'power' },
    { name: 'Breathing Exercises', section: 'power' },
    { name: 'HIIT Workout', section: 'power' },
    { name: 'Core Training', section: 'power' },

    { name: 'Stretching', section: 'power' },
    { name: 'Mobility Training', section: 'power' },

    { name: 'Work', section: 'craft' },
    { name: 'Coding', section: 'craft' },
    { name: 'Studying', section: 'craft' },
    { name: 'Writing', section: 'craft' },
    { name: 'Designing', section: 'craft' },

    { name: 'Video Editing', section: 'craft' },
    { name: 'Content Creation', section: 'craft' },
    { name: 'Business Building', section: 'craft' },
    { name: 'Marketing', section: 'craft' },
    { name: 'Sales', section: 'craft' },

    { name: 'Freelancing', section: 'craft' },
    { name: 'Teaching', section: 'craft' },
    { name: 'Public Speaking', section: 'craft' },
    { name: 'Language Learning', section: 'craft' },
    { name: 'Music Practice', section: 'craft' },

    { name: 'Photography', section: 'craft' },
    { name: 'Animation', section: 'craft' },
    { name: '3D Designing', section: 'craft' },
    { name: 'Networking', section: 'craft' },
    { name: 'Project Building', section: 'craft' },

  ];

  for (const activity of activities) {
    const existing = await prisma.activities.findFirst({
      where: {
        user_id: null,
        name: activity.name,
        section: activity.section,
      },
    });

    if (!existing) {
      await prisma.activities.create({
        data: {
          ...activity,
          user_id: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    }
  }

  console.log('✅ Activities seeded');
}