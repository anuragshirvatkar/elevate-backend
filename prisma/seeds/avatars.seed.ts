import { Prisma, PrismaClient } from '@prisma/client';

export async function seedAvatars(prisma: PrismaClient) {
  const avatars = [
    {
      slug: 'riven',
      name: 'Riven',
      title: 'Everyone starts somewhere.',
      story: `Riven had nothing special. Just a start.

No skill.
No discipline.
No clear direction.

Just a simple blade and a decision to begin.

He didn’t know the path.
He didn’t have answers.

But he stood there anyway.

Every step forward would shape him.
Every choice would define him.

Nothing about him was complete.

That was the point.`,

      profile_image_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778406488/beginer-profile-pic_vplbhs.png',

      full_body_image_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778406494/beginer-full-body_i5a0fv.png',

      unlock_category: 'beginner',

      unlock_requirement: {
        type: 'default',
      },

      revoke_requirement: Prisma.JsonNull,

      is_default: true,
    },

    {
      slug: 'renji',
      name: 'Renji',
      title: 'Consistency over intensity.',

      story: `Renji was not known for talent. He was known for returning.

He was never the fastest with the blade.
Never the most naturally gifted.

But every morning, before the sun rose, he stood in the same place and practiced the same strike.

Again.
And again.
And again.

There were days his form broke.
Days his hands felt heavy.
Days he questioned if it was leading anywhere.

He still showed up.

Years passed. Nothing dramatic changed overnight.

But one day, people stopped questioning his skill.

Not because he chased mastery.

But because he stayed long enough that mastery had no choice but to meet him.`,

      profile_image_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778406498/samurai-profile_gbfv9t.png',

      full_body_image_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778406500/samurai-full-body_wd2da8.png',

      unlock_category: 'craft',

      unlock_requirement: {
        weeks: 3,
        days_per_week: 3,
      },

      revoke_requirement: {
        miss_days_next_week: 3,
      },

      is_default: false,
    },

    {
      slug: 'verin',
      name: 'Verin',
      title: 'Learn it. Refine it. Use it.',

      story: `He carried a spell book.

Anything useful, he wrote into it.
Anything weak, he ignored.

Over time, the book filled with knowledge he could trust.

In his other hand, he held a dark sphere.

When needed, he opened the book, chose what worked, and cast it without hesitation.

Nothing was random.
Everything he used had already been tested.`,

      profile_image_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778406519/mage-profile-pic_zwmqsb.png',

      full_body_image_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778406520/mage-full-body_rddt2j.png',

      unlock_category: 'mind',

      unlock_requirement: {
        weeks: 2,
        days_per_week: 3,
      },

      revoke_requirement: {
        skip_week: true,
      },

      is_default: false,
    },

    {
      slug: 'aelius',
      name: 'Aelius',
      title: 'Strength is built quietly, then carried everywhere.',

      story: `Aelius was not born strong. He became something else.

He trained past comfort.
Past fatigue.
Past the point most people stop.

Each time he held his ground, something in him changed.

Slowly, his body adapted.
His limits moved.

Over time, the strength he built took form.

Not just muscle, but presence.

He became a Spartan.`,

      profile_image_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778406530/spartan-profile_wq0koc.png',

      full_body_image_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778406529/spartan-full-body_eclddo.png',

      unlock_category: 'power',

      unlock_requirement: {
        weeks: 2,
        days_per_week: 4,
      },

      revoke_requirement: {
        miss_days_next_week: 4,
      },

      is_default: false,
    },

    {
      slug: 'kael',
      name: 'Kael',
      title: 'Control over lust builds real strength.',

      story: `Kael once had white wings.

He was in control.

Then he gave in to lust.

Not once, but enough that it changed him.
His clarity faded.
His discipline weakened.

And he fell.

His wings were gone.

There was no sudden fix.
No moment of redemption.

He rebuilt it slowly.

Saying no when it was easier to give in.
Holding control when no one was watching.

Over time, something returned.

Not the same wings.

New ones.

Darker. Stronger.
Earned through control.`,

      profile_image_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778406541/angel-profile-pic_gxv2pi.png',

      full_body_image_url:
        'https://res.cloudinary.com/dpy2frmzi/image/upload/v1778406541/angel-ful-body_pogeu1.png',

      unlock_category: 'purity',

      unlock_requirement: {
        max_relapses_per_month: 1,
      },

      revoke_requirement: {
        relapses_in_month: 2,
      },

      is_default: false,
    },
  ];

  for (const avatar of avatars) {
    await prisma.avatars.upsert({
      where: {
        slug: avatar.slug,
      },

      update: {
        ...avatar,
      },

      create: {
        ...avatar,
        created_at: new Date(),
      },
    });
  }

  console.log(' Avatars seeded');
}