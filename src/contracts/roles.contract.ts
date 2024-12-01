export const USER_ROLE_LIST = [
  'MANAGER',
  'DEVELOPER',
  'PRODUCT_OWNER',
  'SUPPORT_STAFF',
  'HOBBYIST',
] as const;

export type UserRole = typeof USER_ROLE_LIST[number]; 