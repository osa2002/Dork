import { LoadTestRunner } from "../load/LoadTestRunner";
import { StressTestRunner } from "../stress/StressTestRunner";
import { ChaosTestRunner } from "../chaos/ChaosTestRunner";
import { RecoveryTestRunner } from "../recovery/RecoveryTestRunner";
import { EvidenceCollector } from "../evidence/EvidenceCollector";
import { AggregatedEvidencePackage } from "../evidence/EvidenceTypes";

export interface ValidationExecutionOptions {
  runLoad?: boolean;
  runStress?: boolean;
  runChaos?: boolean;
  runRecovery?: boolean;
  tenantId?: string;
}

export class OperationalValidationSuite {
  private loadRunner = new LoadTestRunner();
  private stressRunner = new StressTestRunner();
  private chaosRunner = new ChaosTestRunner();
  private recoveryRunner = new RecoveryTestRunner();
  private collector = EvidenceCollector.getInstance();

  public async runFullSuite(options: ValidationExecutionOptions = {}): Promise<AggregatedEvidencePackage> {
    const {
      runLoad = true,
      runStress = true,
      runChaos = true,
      runRecovery = true,
      tenantId = "default"
    } = options;

    // 1. Load Test Execution
    if (runLoad) {
      await this.loadRunner.executeScenario({
        scenarioId: "val-load-01",
        scenarioName: "Sustained Baseline Operational Load",
        concurrencyUsers: 25,
        durationSeconds: 2,
        expectedMaxP99Ms: 150,
        maxAllowedErrorRatePercent: 0.5
      });
    } else {
      this.collector.recordNotExecuted("val-load-01", "Sustained Baseline Operational Load", "LOAD", "Load test execution unselected");
    }

    // 2. Stress Test Execution
    if (runStress) {
      await this.stressRunner.executeScenario({
        scenarioId: "val-stress-01",
        scenarioName: "Horizontal Scaling & Memory Saturation Test",
        stepConcurrencyLevels: [10, 25, 50],
        stepDurationSeconds: 1,
        maxCpuPercentCeiling: 85,
        maxMemoryMbCeiling: 1024,
        maxEventLoopLagMsCeiling: 50
      });
    } else {
      this.collector.recordNotExecuted("val-stress-01", "Horizontal Scaling & Memory Saturation Test", "STRESS", "Stress test execution unselected");
    }

    // 3. Chaos Test Executions
    if (runChaos) {
      await this.chaosRunner.executeFaultInjection({
        faultId: "val-chaos-01",
        scenarioName: "Injected Network Latency Circuit Breaker",
        faultType: "LATENCY_DEGRADATION",
        injectedLatencyMs: 100
      });

      await this.chaosRunner.executeFaultInjection({
        faultId: "val-chaos-02",
        scenarioName: "Duplicate Event Payload Idempotency Interception",
        faultType: "DUPLICATE_PAYLOAD_BURST",
        duplicateCount: 10
      });

      await this.chaosRunner.executeFaultInjection({
        faultId: "val-chaos-03",
        scenarioName: "Worker Node Termination & Lock Lease Expiration",
        faultType: "WORKER_TERMINATION"
      });

      await this.chaosRunner.executeFaultInjection({
        faultId: "val-chaos-04",
        scenarioName: "Dead-Letter Queue Webhook Retry Handling",
        faultType: "WEBHOOK_FAILURE"
      });
    } else {
      this.collector.recordNotExecuted("val-chaos-01", "Injected Network Latency Circuit Breaker", "CHAOS", "Chaos suite unselected");
      this.collector.recordNotExecuted("val-chaos-02", "Duplicate Event Payload Idempotency Interception", "CHAOS", "Chaos suite unselected");
    }

    // 4. Disaster Recovery Execution
    if (runRecovery) {
      await this.recoveryRunner.executeRecoveryScenario({
        scenarioId: "val-recovery-01",
        scenarioName: "Transactional Outbox Drain & Failover Recovery",
        targetRtoSeconds: 30,
        targetRpoSeconds: 1
      });
    } else {
      this.collector.recordNotExecuted("val-recovery-01", "Transactional Outbox Drain & Failover Recovery", "RECOVERY", "Recovery suite unselected");
    }

    // Persist evidence artifacts to Firestore
    await this.collector.persistToFirestore(tenantId);

    return this.collector.generateEvidencePackage();
  }
}
