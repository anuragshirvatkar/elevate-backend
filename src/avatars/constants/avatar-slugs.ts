export const AvatarSlugs = {
  RIVEN: 'riven',
  DRENA: 'drena',
  AELIUS: 'aelius',
  RENJI: 'renji',
  VERIN: 'verin',
  KAEL: 'kael',
} as const;

export type AvatarSlug = (typeof AvatarSlugs)[keyof typeof AvatarSlugs];

export const BEGINNER_AVATAR_SLUGS = [AvatarSlugs.RIVEN, AvatarSlugs.DRENA] as const;

export function isBeginnerAvatar(slug: string): boolean {
  return (BEGINNER_AVATAR_SLUGS as readonly string[]).includes(slug);
}
