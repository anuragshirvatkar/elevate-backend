export const AvatarSlugs = {
  RIVEN: 'riven',
  AELIUS: 'aelius',
  RENJI: 'renji',
  VERIN: 'verin',
  KAEL: 'kael',
} as const;

export type AvatarSlug = (typeof AvatarSlugs)[keyof typeof AvatarSlugs];
