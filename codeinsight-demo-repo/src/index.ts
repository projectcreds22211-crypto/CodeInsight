import { userService } from "./modules/users/user.service";
import { taskService } from "./modules/tasks/task.service";
import { ledgerService } from "./modules/ledger/ledger.service";
import { reportGenerator } from "./modules/reports/report.generator";
import { summaryService } from "./modules/reports/summary.service";
import { Logger } from "./utils/logger";

const logger = new Logger("ApplicationMain");

export async function bootstrapDemo(): Promise<void> {
  logger.info("Initializing TaskLedger service demonstration...");

  const user = await userService.getUser("usr_101");
  logger.info(`Loaded default user: ${user.name} (${user.email})`);

  const task = await taskService.getTaskById("tsk_501");
  logger.info(`Loaded active task: ${task.title} [Status: ${task.status}]`);

  const summary = await ledgerService.getTaskLedgerSummary(task.id);
  logger.info(`Task ledger summary: ${summary.count} entries, $${summary.totalAmount} billed`);

  const start = new Date(Date.now() - 30 * 86400 * 1000);
  const end = new Date();
  const report = await reportGenerator.generateMonthlyBillingReport(task.projectId, start, end, {
    includeCsv: true,
    targetCurrency: "USD",
  });

  logger.info(`Generated report for project ${report.projectId}: Total Billed = ${report.formattedCurrency}`);

  const header = summaryService.buildExecutiveSummaryHeader(task.projectId, user.name);
  logger.info(`Summary header generated (${header.length} bytes)`);
}

if (require.main === module) {
  bootstrapDemo().catch((err) => {
    logger.error("Application bootstrap error", { error: String(err) });
  });
}
