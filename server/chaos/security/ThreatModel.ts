export type ThreatCategory =
  | "Authentication"
  | "Authorization"
  | "API"
  | "Firestore"
  | "EventBus"
  | "PlatformKernel"
  | "CICD"
  | "CloudRun"
  | "Secrets"
  | "SupplyChain";

export type STRIDEType =
  | "Spoofing"
  | "Tampering"
  | "Repudiation"
  | "InformationDisclosure"
  | "DenialOfService"
  | "ElevationOfPrivilege";

export type ThreatSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type MitigationStatus =
  | "MITIGATED"
  | "PARTIALLY_MITIGATED"
  | "UNMITIGATED"
  | "ACCEPTED";

export interface ThreatItem {
  readonly id: string;
  readonly name: string;
  readonly category: ThreatCategory;
  readonly stride: STRIDEType;
  readonly severity: ThreatSeverity;
  readonly description: string;
  readonly impactedComponents: readonly string[];
  readonly mitigation: string;
  readonly status: MitigationStatus;
  readonly verificationCheck: string;
  readonly cvssScore: number;
}

export interface ThreatMatrixEntry {
  readonly category: ThreatCategory;
  readonly total: number;
  readonly mitigated: number;
  readonly unmitigated: number;
  readonly criticals: number;
  readonly highs: number;
  readonly scorePercent: number;
}

export interface ThreatModelReport {
  readonly timestamp: string;
  readonly correlationId: string;
  readonly totalThreats: number;
  readonly mitigatedCount: number;
  readonly partiallyMitigatedCount: number;
  readonly unmitigatedCount: number;
  readonly criticalCount: number;
  readonly highCount: number;
  readonly mediumCount: number;
  readonly lowCount: number;
  readonly overallThreatScore: number;
  readonly matrix: readonly ThreatMatrixEntry[];
  readonly threats: readonly ThreatItem[];
}
