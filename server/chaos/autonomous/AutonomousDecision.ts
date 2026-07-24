import { DecisionContext } from "./DecisionContext";

export type DecisionType =
  | "NO_ACTION"
  | "MONITOR"
  | "RUN_EXPERIMENT"
  | "ROLLBACK"
  | "PAUSE_EXPERIMENTS"
  | "REDUCE_RISK"
  | "ESCALATE"
  | "OPEN_INCIDENT"
  | "REQUEST_APPROVAL";

export interface AutonomousDecision {
  id: string;
  timestamp: string;
  decision: DecisionType;
  confidence: number; // 0 to 100
  reasoning: string;
  context: DecisionContext;
  evidence: string[];
}
