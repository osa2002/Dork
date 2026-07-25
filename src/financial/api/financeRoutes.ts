import { Router } from "express";
import { FinanceApiController } from "./FinanceApiController";

const router = Router();

// Revenue Recognition
router.post("/revenue/contracts", FinanceApiController.createRevenueContract);

// Period Close Validation
router.post("/period/validate-close", FinanceApiController.validatePeriodClose);

// FX Currency Engine
router.post("/fx/convert", FinanceApiController.convertFx);

// Financial Reconciliation
router.post("/reconciliation/reconcile", FinanceApiController.reconcile);

// Tax Calculation Engine
router.post("/tax/calculate", FinanceApiController.calculateTax);

// Refund Approval Workflow
router.post("/refunds/evaluate", FinanceApiController.evaluateRefund);

// Risk & Fraud Evaluation
router.post("/risk/evaluate", FinanceApiController.evaluateRisk);

// Financial Reports
router.get("/reports/income-statement", FinanceApiController.getIncomeStatement);
router.get("/reports/balance-sheet", FinanceApiController.getBalanceSheet);

// FinOps Dashboard Model
router.get("/dashboard", FinanceApiController.getFinOpsDashboard);

export default router;
