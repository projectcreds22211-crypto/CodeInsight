import { User, CreateUserDto, UpdateUserDto } from "./user.types";

export class UserRepository {
  private users: Map<string, User> = new Map();

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults(): void {
    const defaultUser: User = {
      id: "usr_101",
      email: "alex.dev@company.com",
      name: "Alex Dev",
      organizationId: "org_999",
      tier: "pro",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };
    this.users.set(defaultUser.id, defaultUser);
  }

  public async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  public async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  public async create(dto: CreateUserDto): Promise<User> {
    const id = `usr_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const now = new Date();
    const user: User = {
      id,
      email: dto.email,
      name: dto.name,
      organizationId: dto.organizationId,
      tier: dto.tier ?? "standard",
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, user);
    return user;
  }

  public async update(id: string, dto: UpdateUserDto): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) {
      return null;
    }
    const updated: User = {
      ...user,
      ...dto,
      updatedAt: new Date(),
    };
    this.users.set(id, updated);
    return updated;
  }
}

export const userRepository = new UserRepository();
