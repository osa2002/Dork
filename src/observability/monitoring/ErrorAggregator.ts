export interface AggregatedErrorGroup {
  fingerprint: string;
  errorName: string;
  messageSample: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  affectedTenants: Set<string>;
  sampleStack?: string;
}

export class ErrorAggregator {
  private static instance: ErrorAggregator;
  private errorGroups: Map<string, AggregatedErrorGroup> = new Map();

  public static getInstance(): ErrorAggregator {
    if (!ErrorAggregator.instance) {
      ErrorAggregator.instance = new ErrorAggregator();
    }
    return ErrorAggregator.instance;
  }

  public recordError(error: Error | any, tenantId?: string): string {
    const name = error?.name || "Error";
    const msg = error?.message || String(error);
    const fingerprint = this.computeFingerprint(name, msg);

    const now = new Date().toISOString();

    if (this.errorGroups.has(fingerprint)) {
      const group = this.errorGroups.get(fingerprint)!;
      group.count++;
      group.lastSeen = now;
      if (tenantId) group.affectedTenants.add(tenantId);
    } else {
      const tenants = new Set<string>();
      if (tenantId) tenants.add(tenantId);

      this.errorGroups.set(fingerprint, {
        fingerprint,
        errorName: name,
        messageSample: msg,
        count: 1,
        firstSeen: now,
        lastSeen: now,
        affectedTenants: tenants,
        sampleStack: error?.stack
      });
    }

    return fingerprint;
  }

  private computeFingerprint(name: string, message: string): string {
    const cleanMsg = message.replace(/['"]?(\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b|tx_[a-zA-Z0-9_]+|ba_[a-zA-Z0-9_]+)['"]?/g, ":id");
    return `${name}:${cleanMsg.slice(0, 80)}`;
  }

  public getAggregatedErrors(): Array<Omit<AggregatedErrorGroup, "affectedTenants"> & { affectedTenantsCount: number }> {
    return Array.from(this.errorGroups.values())
      .map(g => ({
        fingerprint: g.fingerprint,
        errorName: g.errorName,
        messageSample: g.messageSample,
        count: g.count,
        firstSeen: g.firstSeen,
        lastSeen: g.lastSeen,
        affectedTenantsCount: g.affectedTenants.size,
        sampleStack: g.sampleStack
      }))
      .sort((a, b) => b.count - a.count);
  }

  public clear(): void {
    this.errorGroups.clear();
  }
}
