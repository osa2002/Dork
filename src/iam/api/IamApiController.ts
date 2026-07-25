import { Request, Response } from "express";
import { RbacEngine } from "../rbac/RbacEngine";
import { AbacPolicyEngine } from "../abac/AbacPolicyEngine";
import { SessionManager } from "../session/SessionManager";
import { SsoScimEngine } from "../sso/SsoScimEngine";
import { MfaPasskeyManager } from "../mfa/MfaPasskeyManager";
import { OrgHierarchyAggregate } from "../domain/OrgHierarchy";
import { PermissionAction, PermissionResource } from "../value-objects/IamValueObjects";
import { DistributedTracer } from "../../observability/tracing/DistributedTracer";
import { CloudMetricsCollector } from "../../observability/metrics/CloudMetricsCollector";

const rbacEngine = new RbacEngine();
const abacEngine = new AbacPolicyEngine();
const sessionManager = new SessionManager();
const ssoScimEngine = new SsoScimEngine();
const mfaPasskeyManager = new MfaPasskeyManager();
const tracer = DistributedTracer.getInstance();
const metrics = CloudMetricsCollector.getInstance();

export class IamApiController {
  /**
   * Unified Permission Evaluation Engine Endpoint (RBAC + ABAC + Device Trust)
   */
  public static async evaluatePermission(req: Request, res: Response): Promise<void> {
    const span = tracer.startSpan("IamApiController.evaluatePermission");
    try {
      const {
        tenantId,
        userId,
        assignedRoleIds,
        resource,
        action,
        subjectAttributes,
        resourceAttributes,
        isEncryptedDevice,
        isEdrActive
      } = req.body;

      // 1. RBAC Check
      const isRbacAllowed = rbacEngine.evaluateRbacPermission(
        assignedRoleIds || ["role_developer"],
        resource as PermissionResource,
        action as PermissionAction
      );

      if (!isRbacAllowed) {
        metrics.incrementCounter("iam_permission_evaluations_total", 1, { status: "DENIED_RBAC", resource, action });
        res.json({
          success: true,
          data: {
            allowed: false,
            decisionReason: "Access Denied: Subject roles do not possess required RBAC permission.",
            rbacResult: false,
            abacResult: null
          }
        });
        return;
      }

      // 2. Device Trust Evaluation
      const deviceProfile = sessionManager.evaluateDeviceTrust(
        req.ip || "127.0.0.1",
        req.headers["user-agent"] || "",
        Boolean(isEncryptedDevice),
        Boolean(isEdrActive)
      );

      // 3. ABAC Policy Check
      const abacResult = abacEngine.evaluatePolicy(
        { userId, tenantId, assignedRoleIds: assignedRoleIds || [], ...subjectAttributes },
        { resourceType: resource as PermissionResource, ...resourceAttributes },
        action as PermissionAction,
        {
          ipAddress: req.ip || "127.0.0.1",
          deviceTrustLevel: deviceProfile.trustScore,
          timestampIso: new Date().toISOString(),
          requestHourUtc: new Date().getUTCHours()
        }
      );

      const finalAllowed = isRbacAllowed && abacResult.allowed;

      metrics.incrementCounter("iam_permission_evaluations_total", 1, {
        status: finalAllowed ? "ALLOWED" : "DENIED_ABAC",
        resource,
        action
      });

      res.json({
        success: true,
        data: {
          allowed: finalAllowed,
          decisionReason: abacResult.decisionReason,
          rbacResult: true,
          abacResult,
          deviceTrustProfile: deviceProfile
        }
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    } finally {
      span.end();
    }
  }

  /**
   * Organization Hierarchy Provisioning
   */
  public static async createOrganization(req: Request, res: Response): Promise<void> {
    const span = tracer.startSpan("IamApiController.createOrganization");
    try {
      const { tenantId, name, domain, departments } = req.body;
      const org = OrgHierarchyAggregate.createOrganization(tenantId, name, domain);

      if (Array.isArray(departments)) {
        for (const deptName of departments) {
          OrgHierarchyAggregate.addDepartment(org, deptName);
        }
      }

      metrics.incrementCounter("iam_organizations_created_total", 1, { tenantId });
      res.status(201).json({ success: true, data: org });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    } finally {
      span.end();
    }
  }

  /**
   * Session Issuance & Active Revocation
   */
  public static async createSession(req: Request, res: Response): Promise<void> {
    const span = tracer.startSpan("IamApiController.createSession");
    try {
      const { userId, tenantId, isMfaVerified, mfaTypeUsed, isEncrypted, isEdrActive } = req.body;

      const deviceProfile = sessionManager.evaluateDeviceTrust(
        req.ip || "127.0.0.1",
        req.headers["user-agent"] || "",
        Boolean(isEncrypted),
        Boolean(isEdrActive)
      );

      const session = sessionManager.createSession(
        userId,
        tenantId,
        deviceProfile,
        Boolean(isMfaVerified),
        mfaTypeUsed
      );

      res.status(201).json({ success: true, data: session });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    } finally {
      span.end();
    }
  }

  public static async validateSession(req: Request, res: Response): Promise<void> {
    const span = tracer.startSpan("IamApiController.validateSession");
    try {
      const sessionId = req.headers["x-session-id"] as string || req.body.sessionId;
      const result = sessionManager.validateSession(sessionId);
      res.json({ success: result.isValid, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    } finally {
      span.end();
    }
  }

  /**
   * SSO & SCIM 2.0 User Provisioning Endpoint
   */
  public static async scimProvisionUser(req: Request, res: Response): Promise<void> {
    const span = tracer.startSpan("IamApiController.scimProvisionUser");
    try {
      const tenantId = (req.headers["x-tenant-id"] as string) || req.body.tenantId || "tenant_default";
      const record = ssoScimEngine.processScimCreateUser(tenantId, req.body);

      res.status(201).json({
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
        id: record.externalScimId,
        userName: record.userName,
        name: { givenName: record.givenName, familyName: record.familyName },
        emails: [{ value: record.email, primary: true }],
        active: record.isActive,
        meta: { resourceType: "User", created: record.provisionedAtIso, lastModified: record.updatedAtIso }
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    } finally {
      span.end();
    }
  }

  /**
   * MFA & Passkeys Challenges
   */
  public static async getMfaEnrollment(req: Request, res: Response): Promise<void> {
    const span = tracer.startSpan("IamApiController.getMfaEnrollment");
    try {
      const userId = (req.query.userId as string) || "usr_demo";
      const enrollment = mfaPasskeyManager.getOrCreateEnrollment(userId);
      res.json({ success: true, data: enrollment });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    } finally {
      span.end();
    }
  }

  public static async createPasskeyChallenge(req: Request, res: Response): Promise<void> {
    const span = tracer.startSpan("IamApiController.createPasskeyChallenge");
    try {
      const { userId } = req.body;
      const challenge = mfaPasskeyManager.createPasskeyChallenge(userId);
      res.json({ success: true, data: challenge });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    } finally {
      span.end();
    }
  }
}
