import { Router } from "express";
import { IamApiController } from "./IamApiController";

const router = Router();

// Permission & Policy Evaluation (RBAC + ABAC + Device Trust)
router.post("/evaluate-permission", IamApiController.evaluatePermission);

// Organization Hierarchy Management
router.post("/organizations", IamApiController.createOrganization);

// Session Management & Device Trust
router.post("/sessions", IamApiController.createSession);
router.post("/sessions/validate", IamApiController.validateSession);

// SCIM 2.0 User Provisioning
router.post("/scim/v2/Users", IamApiController.scimProvisionUser);

// MFA & Passkey WebAuthn
router.get("/mfa/enrollment", IamApiController.getMfaEnrollment);
router.post("/mfa/passkeys/challenge", IamApiController.createPasskeyChallenge);

export default router;
