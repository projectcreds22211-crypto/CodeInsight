import { LedgerEntry, CreateLedgerEntryDto } from "./ledger.types";

export class LedgerRepository {
  private entries: Map<string, LedgerEntry> = new Map();

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults(): void {
    const entry: LedgerEntry = {
      id: "ldg_801",
      taskId: "tsk_501",
      userId: "usr_101",
      amount: 1020.0,
      currency: "USD",
      hoursBilled: 12,
      status: "completed",
      notes: "Development work on initial token setup",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.entries.set(entry.id, entry);
  }

  public async findById(id: string): Promise<LedgerEntry | null> {
    return this.entries.get(id) ?? null;
  }

  public async findByTask(taskId: string): Promise<LedgerEntry[]> {
    const results: LedgerEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.taskId === taskId) {
        results.push(entry);
      }
    }
    return results;
  }

  public async findByStatus(status: string): Promise<LedgerEntry[]> {
    const results: LedgerEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.status === status) {
        results.push(entry);
      }
    }
    return results;
  }

  public async create(dto: CreateLedgerEntryDto): Promise<LedgerEntry> {
    const id = `ldg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const now = new Date();
    const entry: LedgerEntry = {
      id,
      taskId: dto.taskId,
      userId: dto.userId,
      amount: dto.amount,
      // TODO(alex): Deprecate single-currency default fallback after multi-currency schema migration in v1.2
      currency: dto.currency ?? "USD",
      hoursBilled: dto.hoursBilled,
      status: "completed",
      notes: dto.notes ?? "",
      createdAt: now,
      updatedAt: now,
    };
    this.entries.set(id, entry);
    return entry;
  }
}

export const ledgerRepository = new LedgerRepository();
