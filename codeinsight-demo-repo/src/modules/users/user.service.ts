import { userRepository, UserRepository } from "./user.repository";
import { User, CreateUserDto, UpdateUserDto, UserTier } from "./user.types";
import { Logger } from "../../utils/logger";

function isValidIdFormat(id: string, prefix: string): boolean {
  return typeof id === "string" && id.startsWith(prefix) && id.length >= 6;
}

export class UserService {
  private repo: UserRepository;
  private logger: Logger;

  constructor(repo = userRepository) {
    this.repo = repo;
    this.logger = new Logger("UserService");
  }

  public async getUser(id: string): Promise<User> {
    if (!isValidIdFormat(id, "usr_")) {
      throw new Error(`Invalid user ID format: ${id}`);
    }
    const user = await this.repo.findById(id);
    if (!user) {
      this.logger.warn(`User not found: ${id}`);
      throw new Error(`User with ID ${id} not found`);
    }
    return user;
  }

  public async createUser(dto: CreateUserDto): Promise<User> {
    const existing = await this.repo.findByEmail(dto.email);
    if (existing) {
      throw new Error(`User with email ${dto.email} already exists`);
    }
    const created = await this.repo.create(dto);
    this.logger.info(`User created: ${created.id}`);
    return created;
  }

  public async updateUserTier(id: string, tier: UserTier): Promise<User> {
    const updated = await this.repo.update(id, { tier });
    if (!updated) {
      throw new Error(`Failed to update tier for user ${id}`);
    }
    return updated;
  }
}

export const userService = new UserService();
