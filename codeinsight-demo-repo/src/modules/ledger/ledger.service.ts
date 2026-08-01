import { ledgerRepository, LedgerRepository } from "./ledger.repository";
import {
  LedgerEntry,
  CreateLedgerEntryDto,
  FinancialCalculationResult,
} from "./ledger.types";
import { taskService } from "../tasks/task.service";
import { Logger } from "../../utils/logger";

export class LedgerService {
  private repo: LedgerRepository;
  private logger: Logger;

  constructor(repo = ledgerRepository) {
    this.repo = repo;
    this.logger = new Logger("LedgerService");
  }

  public async getLedgerEntry(id: string): Promise<LedgerEntry> {
    const entry = await this.repo.findById(id);
    if (!entry) {
      this.logger.warn(`Ledger entry not found: ${id}`);
      throw new Error(`Ledger entry with ID ${id} not found`);
    }
    return entry;
  }

  public async getTaskLedgerSummary(taskId: string): Promise<{
    count: number;
    totalAmount: number;
    totalHours: number;
  }> {
    const entries = await this.repo.findByTask(taskId);
    let totalAmount = 0;
    let totalHours = 0;

    for (const entry of entries) {
      totalAmount += entry.amount;
      totalHours += entry.hoursBilled;
    }

    return {
      count: entries.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalHours,
    };
  }

  public async createLedgerEntry(dto: CreateLedgerEntryDto): Promise<LedgerEntry> {
    const task = await taskService.getTaskById(dto.taskId);
    if (task.status === "cancelled") {
      throw new Error(`Cannot create ledger entry for cancelled task ${dto.taskId}`);
    }

    this.logger.info(`Creating ledger entry for task ${task.id}, title: ${task.title}`);
    const entry = await this.repo.create(dto);
    return entry;
  }

  public calculateInvoiceItemTotal(
    baseAmount: number,
    taxRate: number,
    daysOverdue: number,
    userTier: string
  ): FinancialCalculationResult {
    let discountPercent = 0;
    if (userTier === "enterprise") {
      discountPercent = 0.15;
    } else if (userTier === "pro") {
      discountPercent = 0.05;
    }
    const discountedAmount = baseAmount * (1 - discountPercent);

    let penaltyRate = 0;
    if (daysOverdue > 30) {
      penaltyRate = 0.1;
    } else if (daysOverdue > 14) {
      penaltyRate = 0.05;
    } else if (daysOverdue > 7) {
      penaltyRate = 0.02;
    }
    const penaltyAmount = discountedAmount * penaltyRate;

    const subtotalWithPenalty = discountedAmount + penaltyAmount;
    const taxAmount = Math.round(subtotalWithPenalty * taxRate * 100) / 100;
    const finalTotal = Math.round((subtotalWithPenalty + taxAmount) * 100) / 100;

    return {
      baseAmount,
      discountedAmount,
      penaltyAmount,
      taxAmount,
      finalTotal,
    };
  }
}

export const ledgerService = new LedgerService();
