export interface ConditionRule {
  field: string; // e.g. "global.user_name"
  operator:
    | "equals"
    | "not_equals"
    | "contains"
    | "starts_with"
    | "ends_with"
    | "regex"
    | "gt"
    | "lt"
    | "gte"
    | "lte"
    | "is_true"
    | "is_false"
    | "is_empty"
    | "not_empty";
  value?: string; // value to compare against
}

export const ConditionsService = {
  /**
   * Evaluates a single rule against current variables.
   */
  evaluateRule(rule: ConditionRule, vars: Record<string, any>): boolean {
    const fieldValue = vars[rule.field] !== undefined ? vars[rule.field] : null;
    const ruleValue = rule.value !== undefined ? rule.value : "";

    const strFieldValue = fieldValue !== null ? String(fieldValue) : "";
    const strRuleValue = String(ruleValue);

    switch (rule.operator) {
      case "equals":
        return strFieldValue.toLowerCase() === strRuleValue.toLowerCase();
      case "not_equals":
        return strFieldValue.toLowerCase() !== strRuleValue.toLowerCase();
      case "contains":
        return strFieldValue.toLowerCase().includes(strRuleValue.toLowerCase());
      case "starts_with":
        return strFieldValue.toLowerCase().startsWith(strRuleValue.toLowerCase());
      case "ends_with":
        return strFieldValue.toLowerCase().endsWith(strRuleValue.toLowerCase());
      case "regex":
        try {
          const re = new RegExp(strRuleValue, "i");
          return re.test(strFieldValue);
        } catch {
          return false;
        }
      case "gt":
        return Number(fieldValue) > Number(ruleValue);
      case "lt":
        return Number(fieldValue) < Number(ruleValue);
      case "gte":
        return Number(fieldValue) >= Number(ruleValue);
      case "lte":
        return Number(fieldValue) <= Number(ruleValue);
      case "is_true":
        return fieldValue === true || strFieldValue === "true" || fieldValue === 1;
      case "is_false":
        return fieldValue === false || strFieldValue === "false" || fieldValue === 0;
      case "is_empty":
        return fieldValue === null || fieldValue === undefined || strFieldValue.trim() === "";
      case "not_empty":
        return fieldValue !== null && fieldValue !== undefined && strFieldValue.trim() !== "";
      default:
        return false;
    }
  },

  /**
   * Evaluates complex conditions or switch statements for a node.
   * Returns "true" or "false" for condition node, or branch handle name for switch node.
   */
  evaluateNode(nodeConfig: any, vars: Record<string, any>): string {
    if (nodeConfig.type === "switch") {
      const cases = nodeConfig.cases || []; // Array of { value: string, targetHandle: string }
      const switchVal = String(vars[nodeConfig.field] !== undefined ? vars[nodeConfig.field] : "");
      for (const c of cases) {
        if (switchVal.toLowerCase() === String(c.value).toLowerCase()) {
          return c.targetHandle || "default";
        }
      }
      return "default";
    }

    const rules = nodeConfig.rules || [];
    if (rules.length === 0) return "true";

    const operator = nodeConfig.logicalOperator || "AND";
    const results = rules.map((r: ConditionRule) => this.evaluateRule(r, vars));

    const finalBool = operator === "AND" ? results.every(Boolean) : results.some(Boolean);
    return finalBool ? "true" : "false";
  }
};
