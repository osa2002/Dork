import { EvidenceCollector } from "../evidence/EvidenceCollector";
import { AggregatedEvidencePackage } from "../evidence/EvidenceTypes";

export class ValidationReportGenerator {
  private collector = EvidenceCollector.getInstance();

  public generateFullValidationSuiteReport(): {
    evidencePackage: AggregatedEvidencePackage;
    markdownSummary: string;
    jsonExport: string;
    csvExport: string;
  } {
    const pkg = this.collector.generateEvidencePackage();
    const markdownSummary = this.collector.exportAsMarkdown(pkg);
    const jsonExport = this.collector.exportAsJson(pkg);
    const csvExport = this.collector.exportAsCsv(pkg);

    return {
      evidencePackage: pkg,
      markdownSummary,
      jsonExport,
      csvExport
    };
  }
}
