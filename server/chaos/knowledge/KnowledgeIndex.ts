import { KnowledgeRecord } from "./KnowledgeRecord";

export class KnowledgeIndex {
  private static experimentIndex: Map<string, string[]> = new Map();
  private static serviceIndex: Map<string, string[]> = new Map();
  private static dependencyIndex: Map<string, string[]> = new Map();
  private static workflowIndex: Map<string, string[]> = new Map();
  private static incidentIndex: Map<string, string[]> = new Map();
  private static statusIndex: Map<string, string[]> = new Map();
  private static tagIndex: Map<string, string[]> = new Map();

  /**
   * Automatically rebuilds all indexes based on the current records inside the repository.
   * This ensures the index is always perfectly synchronized and memory-bound.
   */
  public static rebuild(records: readonly KnowledgeRecord[]): void {
    this.experimentIndex.clear();
    this.serviceIndex.clear();
    this.dependencyIndex.clear();
    this.workflowIndex.clear();
    this.incidentIndex.clear();
    this.statusIndex.clear();
    this.tagIndex.clear();

    for (const record of records) {
      // 1. Experiment Index
      this.addToMap(this.experimentIndex, record.experimentId, record.id);

      // 2. Service and Dependency Indexes (from dependencyGraphSnapshot)
      if (record.dependencyGraphSnapshot?.nodes) {
        for (const node of record.dependencyGraphSnapshot.nodes) {
          if (node.type === "service") {
            this.addToMap(this.serviceIndex, node.id, record.id);
          } else {
            this.addToMap(this.dependencyIndex, node.id, record.id);
          }
        }
      }

      // 3. Workflow Index
      if (record.workflow) {
        this.addToMap(this.workflowIndex, record.workflow, record.id);
      }

      // 4. Incident Index
      if (record.incidentId) {
        this.addToMap(this.incidentIndex, record.incidentId, record.id);
      }

      // 5. Status Index
      if (record.status) {
        this.addToMap(this.statusIndex, record.status, record.id);
      }

      // 6. Tag Index
      if (record.tags) {
        for (const tag of record.tags) {
          this.addToMap(this.tagIndex, tag, record.id);
        }
      }
    }
  }

  private static addToMap(map: Map<string, string[]>, key: string, value: string) {
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(value);
  }

  // --- Lookup Helpers ---

  public static getExperimentIndexKeys(): string[] {
    return Array.from(this.experimentIndex.keys());
  }

  public static getServiceIndexKeys(): string[] {
    return Array.from(this.serviceIndex.keys());
  }

  public static getDependencyIndexKeys(): string[] {
    return Array.from(this.dependencyIndex.keys());
  }

  public static getWorkflowIndexKeys(): string[] {
    return Array.from(this.workflowIndex.keys());
  }

  public static getIncidentIndexKeys(): string[] {
    return Array.from(this.incidentIndex.keys());
  }

  public static getStatusIndexKeys(): string[] {
    return Array.from(this.statusIndex.keys());
  }

  public static getTagIndexKeys(): string[] {
    return Array.from(this.tagIndex.keys());
  }

  // --- Resolvers mapping index lists to records ---

  public static resolveIds(ids: string[], allRecords: readonly KnowledgeRecord[]): KnowledgeRecord[] {
    if (!ids) return [];
    return allRecords.filter((r) => ids.includes(r.id));
  }

  public static getByExperiment(experimentId: string, allRecords: readonly KnowledgeRecord[]): KnowledgeRecord[] {
    return this.resolveIds(this.experimentIndex.get(experimentId) || [], allRecords);
  }

  public static getByService(serviceId: string, allRecords: readonly KnowledgeRecord[]): KnowledgeRecord[] {
    return this.resolveIds(this.serviceIndex.get(serviceId) || [], allRecords);
  }

  public static getByDependency(dependencyId: string, allRecords: readonly KnowledgeRecord[]): KnowledgeRecord[] {
    return this.resolveIds(this.dependencyIndex.get(dependencyId) || [], allRecords);
  }

  public static getByWorkflow(workflowName: string, allRecords: readonly KnowledgeRecord[]): KnowledgeRecord[] {
    return this.resolveIds(this.workflowIndex.get(workflowName) || [], allRecords);
  }

  public static getByIncident(incidentId: string, allRecords: readonly KnowledgeRecord[]): KnowledgeRecord[] {
    return this.resolveIds(this.incidentIndex.get(incidentId) || [], allRecords);
  }

  public static getByStatus(status: string, allRecords: readonly KnowledgeRecord[]): KnowledgeRecord[] {
    return this.resolveIds(this.statusIndex.get(status) || [], allRecords);
  }

  public static getByTag(tag: string, allRecords: readonly KnowledgeRecord[]): KnowledgeRecord[] {
    return this.resolveIds(this.tagIndex.get(tag) || [], allRecords);
  }
}
