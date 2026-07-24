/**
 * Enterprise Platform Administration - Security Center Controller
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 * Controller Layer for Security, Sessions, Threats, RBAC & API Keys
 */

import { Response, NextFunction } from "express";
import { IAdminSecurityController } from "./IAdminController";
import { ISecurityAdminService } from "../services/IAdminService";
import { AdminAuthenticatedRequest } from "../middleware/adminAuthMiddleware";

export class AdminSecurityController implements IAdminSecurityController {
  constructor(private securityService: ISecurityAdminService) {}

  public listActiveSessions = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = {
        status: req.query.status as string,
        userEmail: req.query.userEmail as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20
      };
      const result = await this.securityService.listActiveSessions(query, req.adminIdentity!);
      res.json({
        status: "success",
        data: result
      });
    } catch (err) {
      next(err);
    }
  };

  public revokeSession = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const revoked = await this.securityService.revokeSession(sessionId, req.adminIdentity!);
      res.json({
        status: "success",
        message: `Session '${sessionId}' successfully revoked.`,
        data: revoked
      });
    } catch (err) {
      next(err);
    }
  };

  public revokeAllUserSessions = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userEmail, reason } = req.body;
      const result = await this.securityService.revokeAllUserSessions({ userEmail, reason }, req.adminIdentity!);
      res.json({
        status: "success",
        message: `Revoked all active sessions for '${userEmail}'.`,
        data: result
      });
    } catch (err) {
      next(err);
    }
  };

  public listLoginHistory = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = {
        userEmail: req.query.userEmail as string,
        status: req.query.status as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20
      };
      const result = await this.securityService.listLoginHistory(query, req.adminIdentity!);
      res.json({
        status: "success",
        data: result
      });
    } catch (err) {
      next(err);
    }
  };

  public getFailedLoginAnalytics = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const analytics = await this.securityService.getFailedLoginAnalytics(req.adminIdentity!);
      res.json({
        status: "success",
        data: analytics
      });
    } catch (err) {
      next(err);
    }
  };

  public listSuspiciousActivities = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = {
        status: req.query.status as string,
        severity: req.query.severity as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20
      };
      const result = await this.securityService.listSuspiciousActivities(query, req.adminIdentity!);
      res.json({
        status: "success",
        data: result
      });
    } catch (err) {
      next(err);
    }
  };

  public updateSuspiciousActivity = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { activityId } = req.params;
      const updated = await this.securityService.updateSuspiciousActivity(activityId, req.body, req.adminIdentity!);
      res.json({
        status: "success",
        message: `Suspicious activity '${activityId}' updated.`,
        data: updated
      });
    } catch (err) {
      next(err);
    }
  };

  public listDeviceInventory = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = {
        userEmail: req.query.userEmail as string,
        status: req.query.status as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20
      };
      const result = await this.securityService.listDeviceInventory(query, req.adminIdentity!);
      res.json({
        status: "success",
        data: result
      });
    } catch (err) {
      next(err);
    }
  };

  public updateDeviceStatus = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { deviceId } = req.params;
      const updated = await this.securityService.updateDeviceStatus(deviceId, req.body, req.adminIdentity!);
      res.json({
        status: "success",
        message: `Device '${deviceId}' status updated.`,
        data: updated
      });
    } catch (err) {
      next(err);
    }
  };

  public listRoleAssignments = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const roles = await this.securityService.listRoleAssignments(req.adminIdentity!);
      res.json({
        status: "success",
        data: { roles, total: roles.length }
      });
    } catch (err) {
      next(err);
    }
  };

  public updateRoleAssignment = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { adminId } = req.params;
      const updated = await this.securityService.updateRoleAssignment(adminId, req.body, req.adminIdentity!);
      res.json({
        status: "success",
        message: `Admin '${adminId}' role updated to '${req.body.role}'.`,
        data: updated
      });
    } catch (err) {
      next(err);
    }
  };

  public getPermissionAuditSummary = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const summary = await this.securityService.getPermissionAuditSummary(req.adminIdentity!);
      res.json({
        status: "success",
        data: summary
      });
    } catch (err) {
      next(err);
    }
  };

  public listApiKeys = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.securityService.listApiKeys(req.adminIdentity!);
      res.json({
        status: "success",
        data: result
      });
    } catch (err) {
      next(err);
    }
  };

  public createApiKey = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const created = await this.securityService.createApiKey(req.body, req.adminIdentity!);
      res.status(201).json({
        status: "success",
        message: "API key successfully created.",
        data: created
      });
    } catch (err) {
      next(err);
    }
  };

  public revokeApiKey = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { keyId } = req.params;
      const revoked = await this.securityService.revokeApiKey(keyId, req.adminIdentity!);
      res.json({
        status: "success",
        message: `API key '${keyId}' revoked.`,
        data: revoked
      });
    } catch (err) {
      next(err);
    }
  };

  public listSecretRotationStatus = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const secrets = await this.securityService.listSecretRotationStatus(req.adminIdentity!);
      res.json({
        status: "success",
        data: { secrets, total: secrets.length }
      });
    } catch (err) {
      next(err);
    }
  };

  public triggerSecretRotation = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { secretId } = req.params;
      const rotated = await this.securityService.triggerSecretRotation(secretId, req.adminIdentity!);
      res.json({
        status: "success",
        message: `Secret '${secretId}' rotation triggered.`,
        data: rotated
      });
    } catch (err) {
      next(err);
    }
  };
}
