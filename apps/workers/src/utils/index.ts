import { SharedContext, UserInput, AgentOutput, Constraints } from "../types";

// Generate a unique session ID
export function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Generate a unique ID for child
export function generateChildId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Generate invite code (6 chars: 2 letters + 2 digits + 2 letters)
export function generateInviteCode(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";

  const part1 = Array.from({ length: 2 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  const part2 = Array.from({ length: 2 }, () => digits[Math.floor(Math.random() * digits.length)]).join("");
  const part3 = Array.from({ length: 2 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");

  return `${part1}${part2}${part3}`;
}

// Build constraints from Round 1 results
export function buildConstraints(
  baziResult: AgentOutput<any>,
  homophoneResult: AgentOutput<any>
): Constraints {
  const constraints: Constraints = {
    mustHave: [],
    avoid: []
  };

  // From Bazi analysis
  if (baziResult.status === "success" && baziResult.data) {
    constraints.mustHave = baziResult.data.recommendedRadicals || [];
    constraints.avoid = [...(baziResult.data.avoidRadicals || [])];
  }

  // From Homophone check
  if (homophoneResult.status === "success" && homophoneResult.data) {
    constraints.avoid = [...constraints.avoid, ...(homophoneResult.data.forbiddenChars || [])];
  }

  return constraints;
}

// Initialize shared context
export function createContext(userInput: UserInput): SharedContext {
  return {
    sessionId: generateSessionId(),
    userInput,
  };
}

// Check if user is premium (has used invite code)
export function isPremiumUser(context: SharedContext): boolean {
  return !!context.userInput.inviteCode;
}

// Validate user input
export function validateInput(input: UserInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.fatherName || input.fatherName.trim().length < 2) {
    errors.push("父亲姓名至少 2 个字");
  }

  if (!input.motherName || input.motherName.trim().length < 2) {
    errors.push("母亲姓名至少 2 个字");
  }

  if (!input.children || input.children.length === 0) {
    errors.push("至少需要一个子女信息");
  }

  for (const child of input.children) {
    if (!child.gender || !["male", "female"].includes(child.gender)) {
      errors.push("子女性别必须是 male 或 female");
    }
    if (!child.birthTime) {
      errors.push("子女出生时间不能为空");
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
