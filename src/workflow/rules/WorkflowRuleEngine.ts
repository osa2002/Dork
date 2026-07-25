export class WorkflowRuleEngine {
  public static evaluateExpression(expression: string, context: Record<string, any>): boolean {
    if (!expression || expression.trim() === "") return true;

    try {
      // Support basic comparison expressions like "amountCents > 10000" or "status == 'PENDING'"
      const sanitizeExpr = expression.trim();

      // Check simple ops: >, <, >=, <=, ==, !=
      const match = sanitizeExpr.match(/^([a-zA-Z0-9_.]+)\s*(==|!=|>=|<=|>|<|contains)\s*(.+)$/);
      if (!match) return true;

      const [, keyPath, op, rawTarget] = match;
      const actualVal = this.resolveKeyPath(keyPath, context);
      let targetVal: any = rawTarget.trim();

      // Parse target value types
      if (targetVal === "true") targetVal = true;
      else if (targetVal === "false") targetVal = false;
      else if (!isNaN(Number(targetVal))) targetVal = Number(targetVal);
      else if (
        (targetVal.startsWith("'") && targetVal.endsWith("'")) ||
        (targetVal.startsWith('"') && targetVal.endsWith('"'))
      ) {
        targetVal = targetVal.substring(1, targetVal.length - 1);
      }

      switch (op) {
        case "==":
          return actualVal == targetVal;
        case "!=":
          return actualVal != targetVal;
        case ">":
          return Number(actualVal) > Number(targetVal);
        case "<":
          return Number(actualVal) < Number(targetVal);
        case ">=":
          return Number(actualVal) >= Number(targetVal);
        case "<=":
          return Number(actualVal) <= Number(targetVal);
        case "contains":
          return String(actualVal).includes(String(targetVal));
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  private static resolveKeyPath(path: string, obj: any): any {
    const parts = path.split(".");
    let curr = obj;
    for (const part of parts) {
      if (curr === undefined || curr === null) return undefined;
      curr = curr[part];
    }
    return curr;
  }
}
