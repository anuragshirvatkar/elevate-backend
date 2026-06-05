import { PrismaClient } from '@prisma/client';

export async function seedAchievements(prisma: PrismaClient) {
  const achievements = [
    // CORE

    {
      name: 'New Journey Begins',
      slug: 'new-journey-begins',
      description: 'Join Elevate!',
      section: 'core',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492760/1_pu1yhw.png',

      condition: {
        type: 'first_login',
      },
    },

    // POWER

    {
      name: 'First Blood',
      slug: 'first-blood',
      description: 'First workout',
      section: 'power',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492761/4_zmjqil.png',

      condition: {
        type: 'workout_count',
        count: 1,
      },
    },

    {
      name: 'Warming Up',
      slug: 'warming-up',
      description: '5 workout streak',
      section: 'power',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492760/2_l97r4b.png',

      condition: {
        type: 'workout_streak',
        days: 5,
      },
    },

    {
      name: 'Getting Serious',
      slug: 'getting-serious',
      description: '10 workout streak',
      section: 'power',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492760/6_yglqy6.png',

      condition: {
        type: 'workout_streak',
        days: 10,
      },
    },

    {
      name: 'Iron Discipline',
      slug: 'iron-discipline',
      description: '20 workout streak',
      section: 'power',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492759/3_dslodh.png',

      condition: {
        type: 'workout_streak',
        days: 20,
      },
    },

    {
      name: 'Unbreakable Routine',
      slug: 'unbreakable-routine',
      description: '30-day workout streak',
      section: 'power',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492760/5_m9lo7t.png',

      condition: {
        type: 'workout_streak',
        days: 30,
      },
    },

    {
      name: 'Beyond Excuses',
      slug: 'beyond-excuses',
      description: 'Workout on a rest day twice',
      section: 'power',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492761/7_ktwmkw.png',

      condition: {
        type: 'workout_on_rest_day',
        count: 2,
      },
    },

    {
      name: 'Built Different',
      slug: 'built-different',
      description: '100 workout streak',
      section: 'power',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492761/8_tyt2y0.png',

      condition: {
        type: 'workout_streak',
        days: 100,
      },
    },

    // CRAFT

    {
      name: 'First Focus',
      slug: 'first-focus',
      description: 'Two 2h+ work sessions',
      section: 'craft',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492763/9_wvvgmk.png',

      condition: {
        type: 'work_session_hours',
        hours: 2,
        count: 2,
      },
    },

    {
      name: 'Locked In',
      slug: 'locked-in',
      description: '3-day streak',
      section: 'craft',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492762/10_htxtja.png',

      condition: {
        type: 'craft_streak',
        days: 3,
      },
    },

    {
      name: 'Deep Worker',
      slug: 'deep-worker',
      description: '10 total hours',
      section: 'craft',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492763/11_sgs4kd.png',

      condition: {
        type: 'craft_total_hours',
        hours: 10,
      },
    },

    {
      name: 'No Distractions',
      slug: 'no-distractions',
      description: '5-day streak',
      section: 'craft',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492763/12_k8wpio.png',

      condition: {
        type: 'craft_streak',
        days: 5,
      },
    },

    {
      name: 'Relentless',
      slug: 'relentless',
      description: '30 total hours',
      section: 'craft',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492763/13_lpk9mw.png',

      condition: {
        type: 'craft_total_hours',
        hours: 30,
      },
    },

    {
      name: 'Obsessed',
      slug: 'obsessed',
      description: '50 total hours',
      section: 'craft',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492764/14_yemjil.png',

      condition: {
        type: 'craft_total_hours',
        hours: 50,
      },
    },

    {
      name: 'Machine Mode',
      slug: 'machine-mode',
      description: '30-day streak',
      section: 'craft',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492764/15_qaufqp.png',

      condition: {
        type: 'craft_streak',
        days: 30,
      },
    },

    // MIND

    {
      name: 'Opened the Book',
      slug: 'opened-the-book',
      description: '3 reading sessions',
      section: 'mind',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492765/16_j8cx0y.png',

      condition: {
        type: 'reading_days',
        days: 3,
      },
    },

    {
      name: 'Thinking Begins',
      slug: 'thinking-begins',
      description: '3 reading days streak',
      section: 'mind',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492765/17_lgokqa.png',

      condition: {
        type: 'reading_streak',
        days: 3,
      },
    },

    {
      name: 'Learner',
      slug: 'learner',
      description:'3 day reading streak',

     condition:{
      type:'reading_streak',
      days:3
     },    
      section: 'mind',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492765/18_okywov.png',

      
    },

    {
      name: 'Knowledge Seeker',
      slug: 'knowledge-seeker',
      description:'15 day reading streak',

condition:{
   type:'reading_streak',
   days:15
},
      section: 'mind',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492766/19_gpeqvg.png',

      
    },

    {
      name: 'Book Finisher',
      slug: 'book-finisher',
      description: 'First book',
      section: 'mind',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492766/20_tfc7bd.png',

      condition: {
        type: 'books_completed',
        count: 1,
      },
    },

    {
      name: 'Evolving Mind',
      slug: 'evolving-mind',
      description: '3 books',
      section: 'mind',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492767/21_p35m6n.png',

      condition: {
        type: 'books_completed',
        count: 3,
      },
    },

    // PURITY

    {
      name: 'Day One',
      slug: 'day-one',
      description: '3-day clean streak',
      section: 'purity',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492767/22_qgdpr1.png',

      condition: {
        type: 'purity_streak',
        days: 3,
      },
    },

    {
      name: 'Holding Line',
      slug: 'holding-line',
      description: '7-day streak',
      section: 'purity',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492768/23_hdgcay.png',

      condition: {
        type: 'purity_streak',
        days: 7,
      },
    },

    {
      name: 'In Control',
      slug: 'in-control',
      description: '15-day streak',
      section: 'purity',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492769/26_bth2zt.png',

      condition: {
        type: 'purity_streak',
        days: 15,
      },
    },

    {
      name: 'Strong Mind',
      slug: 'strong-mind',
      description: '30-day streak',
      section: 'purity',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492768/24_yzpj24.png',

      condition: {
        type: 'purity_streak',
        days: 30,
      },
    },

    {
      name: 'Discipline Wins',
      slug: 'discipline-wins',
      description: '60-day streak',
      section: 'purity',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492770/27_sinpjt.png',

      condition: {
        type: 'purity_streak',
        days: 60,
      },
    },

    {
      name: 'Rare Breed',
      slug: 'rare-breed',
      description: '90-day streak',
      section: 'purity',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492768/25_t5q0nv.png',

      condition: {
        type: 'purity_streak',
        days: 90,
      },
    },

    // CONSISTENCY

    {
      name: 'Self Aware',
      slug: 'self-aware',
      description: '5 journal entries',
      section: 'consistency',

      icon_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778492771/28_gn9j4x.png',

      condition: {
        type: 'journal_entries',
        count: 5,
      },
    },
  ];

  for (const achievement of achievements) {
    await prisma.achievements.upsert({
      where: { slug: achievement.slug },
      create: { ...achievement, created_at: new Date() },
      update: {
        name: achievement.name,
        description: achievement.description,
        condition: achievement.condition,
        icon_url: achievement.icon_url,
        section: achievement.section,
      },
    });
  }

  console.log('✅ Achievements seeded');
}