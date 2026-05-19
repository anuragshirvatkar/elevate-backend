import { USERNAME_PREFIXES } from '../constants/username-prefixes';

export async function generateUsername(prisma: any): Promise<string> {
  let username = '';
  let exists = true;

  while (exists) {
    const randomPrefix = USERNAME_PREFIXES[Math.floor(Math.random() * USERNAME_PREFIXES.length)];
    const randomNumber = Math.floor(Math.random() * 999) + 1;
    username = `${randomPrefix}${randomNumber}`;

    const user = await prisma.users.findFirst({
      where: { username },
    });

    exists = !!user;
  }

  return username;
}
