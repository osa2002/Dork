export interface TestCaseResult {
  testId: string;
  name: string;
  category: string;
  providerId?: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface CertificationSuiteResult {
  suiteName: string;
  passed: boolean;
  totalTests: number;
  passCount: number;
  failCount: number;
  durationMs: number;
  testResults: TestCaseResult[];
}

export interface MasterCertificationReport {
  timestamp: string;
  overallPassed: boolean;
  totalSuites: number;
  passedSuites: number;
  failedSuites: number;
  totalDurationMs: number;
  providersCertified: string[];
  capabilitiesValidated: string[];
  suiteResults: CertificationSuiteResult[];
}
