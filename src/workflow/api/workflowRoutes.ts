import { Router } from "express";
import { WorkflowApiController } from "./WorkflowApiController";

const router = Router();

// Workflow Definition Management
router.post("/definitions", WorkflowApiController.createDefinition);

// Instance Execution & Triggering
router.post("/instances/trigger", WorkflowApiController.triggerWorkflow);

// Human Approval Task Decision
router.post("/approvals/decide", WorkflowApiController.approveTask);

// FinOps Automation Dashboard
router.get("/dashboard", WorkflowApiController.getWorkflowDashboard);

export default router;
