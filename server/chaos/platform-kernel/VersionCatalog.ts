import { ModuleRegistry } from "./ModuleRegistry";

export interface VersionReport {
  readonly isValid: boolean;
  readonly unsupportedVersions: readonly { readonly id: string; readonly version: string }[];
  readonly duplicateVersions: readonly { readonly id: string; readonly versions: readonly string[] }[];
}

export class VersionCatalog {
  private static readonly SEMVER_REGEX = /^(\d+)\.(\d+)\.(\d+)(-[a-zA-Z0-9.]+)?$/;

  /**
   * Validates if a version string is a valid semantic version.
   */
  public static isValidSemver(version: string): boolean {
    return this.SEMVER_REGEX.test(version);
  }

  /**
   * Evaluates if a given version satisfies a semantic versioning range (exact, caret, tilde).
   */
  public static satisfies(version: string, range: string): boolean {
    if (!this.isValidSemver(version)) return false;

    // Exact match
    if (range === version) return true;

    // Tilde range (e.g., ~1.2.0) -> must match major and minor, patch must be >= range patch
    if (range.startsWith("~")) {
      const cleanRange = range.slice(1);
      if (!this.isValidSemver(cleanRange)) return false;
      const [vMajor, vMinor, vPatch] = version.split("-")[0].split(".").map(Number);
      const [rMajor, rMinor, rPatch] = cleanRange.split("-")[0].split(".").map(Number);
      return vMajor === rMajor && vMinor === rMinor && vPatch >= rPatch;
    }

    // Caret range (e.g., ^1.2.0) -> must match major, minor/patch must be >= range
    if (range.startsWith("^")) {
      const cleanRange = range.slice(1);
      if (!this.isValidSemver(cleanRange)) return false;
      const [vMajor, vMinor, vPatch] = version.split("-")[0].split(".").map(Number);
      const [rMajor, rMinor, rPatch] = cleanRange.split("-")[0].split(".").map(Number);

      if (vMajor !== rMajor) return false;
      if (vMinor > rMinor) return true;
      if (vMinor === rMinor) return vPatch >= rPatch;
      return false;
    }

    // If no prefix, assume exact match or simple fallback
    return version === range;
  }

  /**
   * Compiles an audit report for all versions currently registered in the platform.
   */
  public static audit(): VersionReport {
    const modules = ModuleRegistry.getAll();
    const unsupportedVersions: { id: string; version: string }[] = [];
    const duplicatesMap = new Map<string, string[]>();

    modules.forEach((m) => {
      if (!this.isValidSemver(m.version)) {
        unsupportedVersions.push({ id: m.id, version: m.version });
      }

      const existing = duplicatesMap.get(m.id) || [];
      if (!existing.includes(m.version)) {
        existing.push(m.version);
      }
      duplicatesMap.set(m.id, existing);
    });

    const duplicateVersions = Array.from(duplicatesMap.entries())
      .filter(([_, versions]) => versions.length > 1)
      .map(([id, versions]) => ({ id, versions: Object.freeze(versions) }));

    const isValid = unsupportedVersions.length === 0 && duplicateVersions.length === 0;

    return Object.freeze({
      isValid,
      unsupportedVersions: Object.freeze(unsupportedVersions),
      duplicateVersions: Object.freeze(duplicateVersions),
    });
  }
}
