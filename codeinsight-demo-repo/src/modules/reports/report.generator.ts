import { taskService } from "../tasks/task.service";
import { ledgerService } from "../ledger/ledger.service";
import { userService } from "../users/user.service";
import { notificationService, NotificationPayload } from "../notifications/notification.service";
import { convertCurrency, formatCurrency } from "../../utils/currency";
import { sanitizeCsvField, formatDateIso } from "../../utils/formatting";
import { Logger } from "../../utils/logger";

export interface ReportOptions {
  includeCsv?: boolean;
  targetCurrency?: string;
  taxRate?: number;
  dispatchOverdueAlerts?: boolean;
  requesterUserId?: string;
}

export interface BillingReportResult {
  projectId: string;
  periodStart: Date;
  periodEnd: Date;
  totalTaskCount: number;
  completedTaskCount: number;
  totalBilledAmount: number;
  formattedCurrency: string;
  markdownSummary: string;
  csvData?: string;
  alertsDispatchedCount: number;
}

export interface TaskBillingSnapshot {
  taskId: string;
  totalBilled: number;
  totalHours: number;
  entryCount: number;
  outstandingBalance: number;
  isFullySettled: boolean;
}

function isValidIdFormat(id: string, prefix: string): boolean {
  return typeof id === "string" && id.startsWith(prefix) && id.length >= 6;
}

export class ReportGenerator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger("ReportGenerator");
  }

  public async generateTaskBillingSnapshot(taskId: string): Promise<TaskBillingSnapshot> {
    const summary = await ledgerService.getTaskLedgerSummary(taskId);
    const outstandingBalance = Math.max(0, summary.totalAmount - summary.totalHours * 85);
    return {
      taskId,
      totalBilled: summary.totalAmount,
      totalHours: summary.totalHours,
      entryCount: summary.count,
      outstandingBalance,
      isFullySettled: outstandingBalance <= 0,
    };
  }

  public async generateMonthlyBillingReport(
    projectId: string,
    periodStart: Date,
    periodEnd: Date,
    options?: ReportOptions
  ): Promise<BillingReportResult> {
    this.logger.info(`Starting report generation for project ${projectId}`);

    if (!isValidIdFormat(projectId, "prj_")) {
      throw new Error("Invalid project ID provided for report generation");
    }

    if (periodStart >= periodEnd) {
      throw new Error("Period start date must be strictly before period end date");
    }

    const maxPeriodMs = 365 * 86400 * 1000;
    if (periodEnd.getTime() - periodStart.getTime() > maxPeriodMs) {
      throw new Error("Report period exceeds maximum allowed range of 365 days");
    }

    const requesterId = options?.requesterUserId ?? "usr_101";
    const requester = await userService.getUser(requesterId);
    if (!requester) {
      throw new Error(`Requester user not found: ${requesterId}`);
    }

    const targetCurrency = options?.targetCurrency ?? "USD";
    const taxRate = options?.taxRate ?? 0.08;
    const shouldDispatchAlerts = options?.includeCsv ?? true;

    const projectTasks = await taskService.getTasksByProject(projectId);
    this.logger.info(`Fetched ${projectTasks.length} tasks for project ${projectId}`);

    let totalBilledAmountUsd = 0;
    let completedCount = 0;
    let pendingCount = 0;
    let inProgressCount = 0;
    let overdueCount = 0;

    const csvRows: string[] = [];
    if (options?.includeCsv) {
      csvRows.push("Task ID,Title,Status,Priority,Hours,Rate,Amount (USD),Overdue,Assigned User");
    }

    const notificationQueue: NotificationPayload[] = [];
    const now = new Date();

    for (const task of projectTasks) {
      if (task.status === "completed") {
        completedCount++;
      } else if (task.status === "in_progress") {
        inProgressCount++;
      } else if (task.status === "pending") {
        pendingCount++;
      }

      const isOverdue = task.dueDate < now && task.status !== "completed";
      if (isOverdue) {
        overdueCount++;
      }

      const summary = await ledgerService.getTaskLedgerSummary(task.id);
      const baseTaskCost = summary.totalAmount > 0 ? summary.totalAmount : task.estimatedHours * task.hourlyRate;

      let daysOverdue = 0;
      if (isOverdue) {
        daysOverdue = Math.floor((now.getTime() - task.dueDate.getTime()) / (1000 * 3600 * 24));
      }

      const financialCalc = ledgerService.calculateInvoiceItemTotal(
        baseTaskCost,
        taxRate,
        daysOverdue,
        requester.tier
      );

      totalBilledAmountUsd += financialCalc.finalTotal;

      if (options?.includeCsv) {
        const rowStr = [
          sanitizeCsvField(task.id),
          sanitizeCsvField(task.title),
          sanitizeCsvField(task.status),
          sanitizeCsvField(task.priority),
          sanitizeCsvField(task.estimatedHours),
          sanitizeCsvField(task.hourlyRate),
          sanitizeCsvField(financialCalc.finalTotal),
          sanitizeCsvField(isOverdue ? "YES" : "NO"),
          sanitizeCsvField(task.assignedUserId),
        ].join(",");
        csvRows.push(rowStr);
      }

      if (isOverdue && shouldDispatchAlerts) {
        notificationQueue.push({
          recipientId: task.assignedUserId,
          channel: "email",
          subject: `OVERDUE TASK ALERT: ${task.title}`,
          body: `Task ${task.id} (${task.title}) was due on ${formatDateIso(task.dueDate)} and is currently ${daysOverdue} days overdue.`,
          metadata: { taskId: task.id, projectId, daysOverdue },
        });
      }
    }

    let dispatchedCount = 0;
    if (notificationQueue.length > 0 && options?.dispatchOverdueAlerts !== false) {
      dispatchedCount = await notificationService.dispatchBatch(notificationQueue);
      this.logger.info(`Dispatched ${dispatchedCount} overdue alert notifications`);
    }

    const convertedTotal = convertCurrency(totalBilledAmountUsd, "USD", targetCurrency);
    const formattedTotal = formatCurrency(convertedTotal, targetCurrency);

    let md = `# Billing and Task Status Report\n\n`;
    md += `**Project:** ${projectId}\n`;
    md += `**Period:** ${formatDateIso(periodStart)} to ${formatDateIso(periodEnd)}\n`;
    md += `**Generated For:** ${requester.name} (${requester.email}) [Tier: ${requester.tier}]\n\n`;
    md += `## Task Metrics Summary\n`;
    md += `- **Total Tasks:** ${projectTasks.length}\n`;
    md += `- **Completed Tasks:** ${completedCount}\n`;
    md += `- **In Progress Tasks:** ${inProgressCount}\n`;
    md += `- **Pending Tasks:** ${pendingCount}\n`;
    md += `- **Overdue Tasks:** ${overdueCount}\n\n`;
    md += `## Financial Overview\n`;
    md += `- **Subtotal (Base + Tax + Adjustments):** ${formattedTotal} (${targetCurrency})\n`;
    md += `- **Applied Tax Rate:** ${(taxRate * 100).toFixed(1)}%\n`;
    md += `- **Overdue Alerts Dispatched:** ${dispatchedCount}\n\n`;

    return {
      projectId,
      periodStart,
      periodEnd,
      totalTaskCount: projectTasks.length,
      completedTaskCount: completedCount,
      totalBilledAmount: convertedTotal,
      formattedCurrency: formattedTotal,
      markdownSummary: md,
      csvData: options?.includeCsv ? csvRows.join("\n") : undefined,
      alertsDispatchedCount: dispatchedCount,
    };
  }
}

export const reportGenerator = new ReportGenerator();
