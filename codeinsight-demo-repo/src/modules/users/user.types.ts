export type UserTier = "standard" | "pro" | "enterprise";

export interface User {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  tier: UserTier;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDto {
  email: string;
  name: string;
  organizationId: string;
  tier?: UserTier;
}

export interface UpdateUserDto {
  name?: string;
  tier?: UserTier;
}
