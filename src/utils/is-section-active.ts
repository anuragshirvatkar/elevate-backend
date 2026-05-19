export async function isSectionActive(prisma: any, userId: string, section: string): Promise<boolean> {
  const setup = await prisma.user_setups.findUnique({
    where: { user_id_section: { user_id: userId, section } },
    select: { is_active: true },
  });
  if (!setup) return true;
  return setup.is_active ?? true;
}
