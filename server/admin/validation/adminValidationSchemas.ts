/**
 * Enterprise Platform Administration - Validation Schemas
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import { z } from "zod";

export const adminTenantQuerySchema = z.object({
  query: z.object({
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform(val => val ? Math.min(parseInt(val, 10), 100) : 20),
    status: z.enum(["ACTIVE", "SUSPENDED", "DELETED", "PROVISIONING"]).optional(),
    planType: z.enum(["free", "pro", "enterprise"]).optional(),
    region: z.string().optional(),
    search: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    sortBy: z.enum(["createdAt", "dailyTicketCount", "businessName", "quotaUsagePercent"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional()
  })
});

export const updateTenantStatusSchema = z.object({
  params: z.object({
    shopId: z.string().min(1, "Shop ID is required")
  }),
  body: z.object({
    status: z.enum(["ACTIVE", "SUSPENDED"]),
    reason: z.string().min(5, "A valid reason (min 5 chars) is required for status modification")
  })
});

export const updateTenantPlanSchema = z.object({
  params: z.object({
    shopId: z.string().min(1, "Shop ID is required")
  }),
  body: z.object({
    planType: z.enum(["free", "pro", "enterprise"]),
    customQuotaOverride: z.number().positive().optional(),
    reason: z.string().min(5, "A valid reason (min 5 chars) is required for plan modification")
  })
});

export const softDeleteTenantSchema = z.object({
  params: z.object({
    shopId: z.string().min(1, "Shop ID is required")
  }),
  body: z.object({
    reason: z.string().min(10, "A valid justification (min 10 chars) is required for tenant soft deletion")
  })
});

export const tenantAuditHistoryQuerySchema = z.object({
  params: z.object({
    shopId: z.string().min(1, "Shop ID is required")
  }),
  query: z.object({
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform(val => val ? Math.min(parseInt(val, 10), 100) : 50)
  })
});

export const adminAuditLogQuerySchema = z.object({
  query: z.object({
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform(val => val ? Math.min(parseInt(val, 10), 100) : 50),
    actorEmail: z.string().email().optional(),
    targetResourceId: z.string().optional(),
    action: z.string().optional(),
    severity: z.enum(["INFO", "WARNING", "CRITICAL"]).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional()
  })
});

export const updatePlatformConfigSchema = z.object({
  body: z.object({
    globalMaintenanceMode: z.boolean().optional(),
    maxTicketsPerTenantPerDay: z.record(z.string(), z.number().positive()).optional(),
    rateLimitingTierLimits: z.record(z.string(), z.number().positive()).optional(),
    enabledGlobalFeatureFlags: z.record(z.string(), z.boolean()).optional(),
    reason: z.string().min(10, "Audit trail requires a comprehensive reason (min 10 chars)")
  })
});

export const operationsDashboardQuerySchema = z.object({
  query: z.object({
    timeframe: z.enum(["1h", "24h", "7d", "30d"]).optional(),
    bypassCache: z.string().optional().transform(val => val === "true")
  })
});

export const incidentQuerySchema = z.object({
  query: z.object({
    status: z.enum(["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"]).optional(),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    service: z.string().optional(),
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform(val => val ? Math.min(parseInt(val, 10), 100) : 20)
  })
});

export const createIncidentSchema = z.object({
  body: z.object({
    title: z.string().min(5, "Incident title must be at least 5 characters"),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    affectedService: z.string().min(2, "Affected service is required"),
    affectedTenantsCount: z.number().int().nonnegative().optional(),
    summary: z.string().min(10, "Summary must be at least 10 characters")
  })
});

export const updateIncidentSchema = z.object({
  params: z.object({
    incidentId: z.string().min(1, "Incident ID is required")
  }),
  body: z.object({
    status: z.enum(["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"]).optional(),
    summary: z.string().min(5).optional(),
    rootCause: z.string().min(5).optional(),
    updateMessage: z.string().min(5).optional()
  })
});

export const alertQuerySchema = z.object({
  query: z.object({
    status: z.enum(["TRIGGERED", "ACKNOWLEDGED", "RESOLVED"]).optional(),
    severity: z.enum(["INFO", "WARNING", "CRITICAL"]).optional(),
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform(val => val ? Math.min(parseInt(val, 10), 100) : 20)
  })
});

export const createMaintenanceSchema = z.object({
  body: z.object({
    title: z.string().min(5, "Maintenance title is required"),
    description: z.string().min(10, "Description is required"),
    startTime: z.string().datetime({ message: "Must be a valid ISO date time" }),
    endTime: z.string().datetime({ message: "Must be a valid ISO date time" }),
    affectedServices: z.array(z.string()).min(1, "At least one affected service is required")
  })
});

export const updateMaintenanceStatusSchema = z.object({
  params: z.object({
    maintenanceId: z.string().min(1, "Maintenance ID is required")
  }),
  body: z.object({
    status: z.enum(["SCHEDULED", "ACTIVE", "COMPLETED", "CANCELLED"])
  })
});

export const sessionQuerySchema = z.object({
  query: z.object({
    status: z.enum(["ACTIVE", "REVOKED", "EXPIRED"]).optional(),
    userEmail: z.string().email().optional(),
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform(val => val ? Math.min(parseInt(val, 10), 100) : 20)
  })
});

export const revokeSessionSchema = z.object({
  params: z.object({
    sessionId: z.string().min(1, "Session ID is required")
  })
});

export const revokeUserSessionsSchema = z.object({
  body: z.object({
    userEmail: z.string().email("Valid user email is required"),
    reason: z.string().optional()
  })
});

export const loginHistoryQuerySchema = z.object({
  query: z.object({
    userEmail: z.string().optional(),
    status: z.enum(["SUCCESS", "FAILED_PASSWORD", "FAILED_MFA", "BLOCKED_IP"]).optional(),
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform(val => val ? Math.min(parseInt(val, 10), 100) : 20)
  })
});

export const suspiciousActivityQuerySchema = z.object({
  query: z.object({
    status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED", "DISMISSED"]).optional(),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform(val => val ? Math.min(parseInt(val, 10), 100) : 20)
  })
});

export const updateSuspiciousActivitySchema = z.object({
  params: z.object({
    activityId: z.string().min(1, "Activity ID is required")
  }),
  body: z.object({
    status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED", "DISMISSED"]),
    resolutionNotes: z.string().optional()
  })
});

export const deviceInventoryQuerySchema = z.object({
  query: z.object({
    userEmail: z.string().optional(),
    status: z.enum(["APPROVED", "PENDING", "BLOCKED"]).optional(),
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform(val => val ? Math.min(parseInt(val, 10), 100) : 20)
  })
});

export const updateDeviceStatusSchema = z.object({
  params: z.object({
    deviceId: z.string().min(1, "Device ID is required")
  }),
  body: z.object({
    status: z.enum(["APPROVED", "PENDING", "BLOCKED"]),
    isTrusted: z.boolean().optional()
  })
});

export const updateRoleAssignmentSchema = z.object({
  params: z.object({
    adminId: z.string().min(1, "Admin ID is required")
  }),
  body: z.object({
    role: z.enum(["SUPER_ADMIN", "PLATFORM_OPERATOR", "COMPLIANCE_OFFICER", "SUPPORT_ENGINEER", "FINANCE_AUDITOR"]),
    customPermissions: z.array(z.string()).optional(),
    mfaEnforced: z.boolean().optional()
  })
});

export const createApiKeySchema = z.object({
  body: z.object({
    name: z.string().min(3, "API Key name must be at least 3 characters"),
    scopes: z.array(z.string()).min(1, "At least one scope is required"),
    expiresInDays: z.number().int().positive().optional()
  })
});

export const revokeApiKeySchema = z.object({
  params: z.object({
    keyId: z.string().min(1, "Key ID is required")
  })
});

export const triggerSecretRotationSchema = z.object({
  params: z.object({
    secretId: z.string().min(1, "Secret ID is required")
  })
});

