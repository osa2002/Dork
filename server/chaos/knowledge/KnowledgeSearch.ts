import { KnowledgeRecord } from "./KnowledgeRecord";
import { KnowledgeRepository } from "./KnowledgeRepository";
import { KnowledgeIndex } from "./KnowledgeIndex";

export interface SearchFilters {
  readonly experimentId?: string;
  readonly serviceId?: string;
  readonly dependencyId?: string;
  readonly workflow?: string;
  readonly decision?: string;
  readonly incidentId?: string;
  readonly correlationId?: string;
  readonly tag?: string;
  readonly status?: "SUCCESS" | "FAILED" | "DEGRADED" | "SKIPPED" | "PENDING_APPROVAL";
  readonly startDate?: string; // ISO Timestamp format
  readonly endDate?: string;   // ISO Timestamp format
  readonly hasRecovery?: boolean;
}

export class KnowledgeSearch {
  /**
   * Fast indexed-assisted multi-criteria search over in-memory knowledge database.
   */
  public static search(filters: SearchFilters): readonly KnowledgeRecord[] {
    const all = KnowledgeRepository.getAll();
    if (all.length === 0) {
      return [];
    }

    let candidates: readonly KnowledgeRecord[] = all;
    let indexUsed = false;

    // Utilize primary lightweight indexes to narrow down the search space
    if (filters.experimentId) {
      candidates = KnowledgeIndex.getByExperiment(filters.experimentId, all);
      indexUsed = true;
    } else if (filters.serviceId) {
      candidates = KnowledgeIndex.getByService(filters.serviceId, all);
      indexUsed = true;
    } else if (filters.dependencyId) {
      candidates = KnowledgeIndex.getByDependency(filters.dependencyId, all);
      indexUsed = true;
    } else if (filters.workflow) {
      candidates = KnowledgeIndex.getByWorkflow(filters.workflow, all);
      indexUsed = true;
    } else if (filters.incidentId) {
      candidates = KnowledgeIndex.getByIncident(filters.incidentId, all);
      indexUsed = true;
    } else if (filters.status) {
      candidates = KnowledgeIndex.getByStatus(filters.status, all);
      indexUsed = true;
    } else if (filters.tag) {
      candidates = KnowledgeIndex.getByTag(filters.tag, all);
      indexUsed = true;
    }

    // Apply remaining precise query filters on candidate records
    return candidates.filter((r) => {
      // If we jumped from index, double-check filters that didn't drive candidate selection
      if (indexUsed) {
        if (filters.experimentId && r.experimentId !== filters.experimentId) return false;
        if (filters.workflow && r.workflow !== filters.workflow) return false;
        if (filters.incidentId && r.incidentId !== filters.incidentId) return false;
        if (filters.status && r.status !== filters.status) return false;
        if (filters.tag && !r.tags.includes(filters.tag)) return false;

        // Service check
        if (filters.serviceId) {
          const hasService = r.dependencyGraphSnapshot?.nodes?.some(
            (n) => n.id === filters.serviceId && n.type === "service"
          );
          if (!hasService) return false;
        }

        // Dependency check
        if (filters.dependencyId) {
          const hasDep = r.dependencyGraphSnapshot?.nodes?.some(
            (n) => n.id === filters.dependencyId && n.type !== "service"
          );
          if (!hasDep) return false;
        }
      } else {
        // Linear scan filtering when no indexed keys matched or were used
        if (filters.experimentId && r.experimentId !== filters.experimentId) return false;
        if (filters.workflow && r.workflow !== filters.workflow) return false;
        if (filters.incidentId && r.incidentId !== filters.incidentId) return false;
        if (filters.status && r.status !== filters.status) return false;
        if (filters.tag && !r.tags.includes(filters.tag)) return false;

        if (filters.serviceId) {
          const hasService = r.dependencyGraphSnapshot?.nodes?.some(
            (n) => n.id === filters.serviceId && n.type === "service"
          );
          if (!hasService) return false;
        }

        if (filters.dependencyId) {
          const hasDep = r.dependencyGraphSnapshot?.nodes?.some(
            (n) => n.id === filters.dependencyId && n.type !== "service"
          );
          if (!hasDep) return false;
        }
      }

      // Check remaining parameters not covered by primary indexes:

      // Decision Type
      if (filters.decision && r.decision !== filters.decision) {
        return false;
      }

      // Correlation Id
      if (filters.correlationId && r.correlationId !== filters.correlationId) {
        return false;
      }

      // Has Recovery executed
      if (filters.hasRecovery !== undefined) {
        const recordHasRecovery = r.recovery !== null;
        if (recordHasRecovery !== filters.hasRecovery) {
          return false;
        }
      }

      // Date Range Checks
      if (filters.startDate) {
        if (new Date(r.timestamp) < new Date(filters.startDate)) {
          return false;
        }
      }

      if (filters.endDate) {
        if (new Date(r.timestamp) > new Date(filters.endDate)) {
          return false;
        }
      }

      return true;
    });
  }
}
