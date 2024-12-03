export const USER_ROLE_LIST = [
  'BUSINESS',
  'DEVELOPER',
] as const;

export type UserRole = typeof USER_ROLE_LIST[number]; 