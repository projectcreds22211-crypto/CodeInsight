export type LedgerStatus = "draft" | "pending" | "completed" | "reversed";

export interface LedgerEntry {
  id: string;
  taskId: string;
  userId: string;
  amount: number;
  currency: string;
  hoursBilled: number;
  status: LedgerStatus;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLedgerEntryDto {
  taskId: string;
  userId: string;
  amount: number;
  currency?: string;
  hoursBilled: number;
  notes?: string;
}

export interface FinancialCalculationResult {
  baseAmount: number;
  discountedAmount: number;
  penaltyAmount: number;
  taxAmount: number;
  finalTotal: number;
}
