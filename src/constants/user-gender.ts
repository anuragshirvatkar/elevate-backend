export enum UserGender {
  MALE = 'male',
  FEMALE = 'female',
}

export type UserGenderValue = `${UserGender}`;

export const USER_GENDER_VALUES = Object.values(UserGender);

export function shouldShowPurityAnalytics(
  gender: UserGender | string | null | undefined,
): boolean {
  return gender !== UserGender.FEMALE;
}
