import { Request, Response } from "express";
import { RevenueRecognitionEngine } from "../revenue/RevenueRecognitionEngine";
import { PeriodClosingEngine } from "../period/PeriodClosingEngine";
import { FxEngine } from "../fx/FxEngine";
import { ReconciliationMatchingEngine } from "../reconciliation/ReconciliationMatchingEngine";
import { TaxCalculationEngine } from "../tax/TaxCalculationEngine";
import { RefundApprovalEngine } from "../refunds/RefundApprovalEngine";
import { FraudDetectionEngine } from "../risk/FraudDetectionEngine";
import { FinancialReportingService } from "../reporting/FinancialReportingService";
import { FinanceDashboardModels } from "../dashboard/FinanceDashboardModels";
import { CurrencyAmount, CurrencyCode } from "../value-objects/FinancialValueObjects";
import { DistributedTracer } from "../../observability/tracing/DistributedTracer";
import { CloudMetricsCollector } from "../../observability/metrics/CloudMetricsCollector";

const revEngine = new RevenueRecognitionEngine();
const periodEngine = new PeriodClosingEngine();
const fxEngine = new FxEngine();
const reconEngine = new ReconciliationMatchingEngine();
const taxEngine = new TaxCalculationEngine();
const refundEngine = new RefundApprovalEngine();
const fraudEngine = new FraudDetectionEngine();
const reportingService = new FinancialReportingService();
const tracer = DistributedTracer.getInstance();
const metrics = CloudMetricsCollector.getInstance();

export class FinanceApiController {
  public static async createRevenueContract(req: Request, res: Response): Promise<void> {
    const span = tracer.startSpan("FinanceApiController.createRevenueContract");
    try {
      const { tenantId, customerId, totalAmountCents, currency, items } = req.body;
      const amount = new CurrencyAmount(totalAmountCents, currency || "USD");

      const result = revEngine.createContractWithObligations(tenantId, customerId, amount, items || []);

      metrics.incrementCounter("financial_revenue_contracts_created_total", 1, { tenantId });
      metrics.incrementCounter("financial_recognized_revenue_cents", totalAmountCents, { tenantId });

      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    } finally {
      span.end();
    }
  }

  public static async validatePeriodClose(req: Request, res: Response): Promise<void> {
    const span = tracer.startSpan("FinanceApiController.validatePeriodClose");
    try {
      const { unreconciledStatements, pendingOutbox, pendingRefunds } = req.body;
      const result = periodEngine.validatePeriodForClose(
        unreconciledStatements || 0,
        pendingOutbox || 0,
        pendingRefunds || 0
      );
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    } finally {
      span.end();
    }
  }

  public static async convertFx(req: Request, res: Response): Promise<void> {
    const span = tracer.startSpan("FinanceApiController.convertFx");
    try {
      const { amountCents, fromCurrency, toCurrency } = req.body;
      const origAmount = new CurrencyAmount(amountCents, fromCurrency as CurrencyCode);
      const converted = fxEngine.convert(origAmount, toCurrency as CurrencyCode);

      res.json({ success: true, data: { original: origAmount, converted } });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    } finally {
      span.end();
    }
  }

  public static async reconcile(req: Request, res: Response): Promise<void> {
    const span = tracer.startSpan("FinanceApiController.reconcile");
    try {
      const { tenantId, providerId, internalItems, statementItems, feeVarianceToleranceCents } = req.body;
      const result = reconEngine.reconcileBatch(
        tenantId,
        providerId,
        internalItems || [],
        statementItems || [],
        feeVarianceToleranceCents || 50
      );

      metrics.incrementCounter("reconciliation_discrepancies_total", result.discrepanciesCount, { tenantId, providerId });

      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    } finally {
      span.end();
    }
  }

  public static async calculateTax(req: Request, res: Response): Promise<void> {
    const span = tracer.startSpan("FinanceApiController.calculateTax");
    try {
      const { jurisdiction, items, customerVatOrTaxId } = req.body;
      const formattedItems = (items || []).map((it: any, idx: number) => ({
        lineItemId: it.lineItemId || `item_${idx}`,
        category: it.category || "SAAS_SUBSCRIPTION",
        subtotal: new CurrencyAmount(it.subtotalCents, it.currency || "USD"),
        exemptCertificateNumber: it.exemptCertificateNumber
      }));

      const result = taxEngine.calculateTax(jurisdiction, formattedItems, customerVatOrTaxId);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    } finally {
      span.end();
    }
  }

  public static async evaluateRefund(req: Request, res: Response): Promise<void> {
    const span = tracer.startSpan("FinanceApiController.evaluateRefund");
    try {
      const { tenantId, paymentIntentId, refundAmountCents, currency, reason, requestedByUserId, customerTenureDays, customerRiskScore } = req.body;
      const amount = new CurrencyAmount(refundAmountCents, currency || "USD");

      const result = refundEngine.evaluateRequest(
        tenantId,
        paymentIntentId,
        amount,
        reason,
        requestedByUserId,
        customerTenureDays || 30,
        customerRiskScore || 10
      );

      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    } finally {
      span.end();
    }
  }

  public static async evaluateRisk(req: Request, res: Response): Promise<void> {
    const span = tracer.startSpan("FinanceApiController.evaluateRisk");
    try {
      const result = fraudEngine.evaluateRisk(req.body);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    } finally {
      span.end();
    }
  }

  public static async getIncomeStatement(req: Request, res: Response): Promise<void> {
    const span = tracer.startSpan("FinanceApiController.getIncomeStatement");
    try {
      const tenantId = (req.query.tenantId as string) || "tenant_default";
      const periodId = (req.query.periodId as string) || "2026-07";

      const report = reportingService.generateIncomeStatement(
        tenantId,
        periodId,
        15000000, // $150,000 gross
        14200000, // $142,000 recognized
        350000,   // $3,500 gateway fees
        120000    // $1,200 refunds
      );

      res.json({ success: true, data: report });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    } finally {
      span.end();
    }
  }

  public static async getBalanceSheet(req: Request, res: Response): Promise<void> {
    const span = tracer.startSpan("FinanceApiController.getBalanceSheet");
    try {
      const tenantId = (req.query.tenantId as string) || "tenant_default";
      const report = reportingService.generateBalanceSheet(
        tenantId,
        25000000, // Cash $250k
        4500000,  // AR $45k
        8000000,  // Deferred Rev $80k
        1200000   // Tax Payable $12k
      );

      res.json({ success: true, data: report });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    } finally {
      span.end();
    }
  }

  public static async getFinOpsDashboard(req: Request, res: Response): Promise<void> {
    const span = tracer.startSpan("FinanceApiController.getFinOpsDashboard");
    try {
      const dashboard = FinanceDashboardModels.getFinancialOperationsDashboard();
      res.json({ success: true, data: dashboard });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    } finally {
      span.end();
    }
  }
}
