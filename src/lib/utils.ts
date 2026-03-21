/**
 * Utility functions for the baby naming application
 *
 * Provides ID generation, input validation, constraint building,
 * and other shared helper functions.
 *
 * @module utils
 */

import { SharedContext, UserInput, AgentOutput, Constraints, BaziData, HomophoneData } from "../types";

/**
 * Generates a unique session ID for tracking generation jobs
 *
 * Format: `{timestamp}-{random}` (e.g., "1710662400000-abc123")
 *
 * @returns Unique session ID string
 *
 * @example
 * ```typescript
 * const sessionId = generateSessionId();
 * // Use for tracking async generation jobs
 * ```
 */
export function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generates a unique ID for child entries
 *
 * @returns Unique child ID string (6 random characters)
 *
 * @example
 * ```typescript
 * const childId = generateChildId();
 * const child: ChildInfo = { id: childId, gender: "male", birthYear: 2024, birthMonth: 1, birthDay: 1, birthHour: "00" };
 * ```
 */
export function generateChildId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Generates a random invite code in format: 2 letters + 2 digits + 2 letters
 *
 * Examples: "AB12CD", "XY99ZZ"
 *
 * @returns 6-character invite code
 *
 * @example
 * ```typescript
 * const code = generateInviteCode(); // "AB12CD"
 * ```
 */
export function generateInviteCode(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";

  const part1 = Array.from({ length: 2 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  const part2 = Array.from({ length: 2 }, () => digits[Math.floor(Math.random() * digits.length)]).join("");
  const part3 = Array.from({ length: 2 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");

  return `${part1}${part2}${part3}`;
}

/**
 * Builds constraints from Round 1 agent results
 *
 * Extracts recommended and avoided radicals from Bazi analysis
 * and forbidden characters from homophone check.
 *
 * @param baziResult - Bazi analysis result
 * @param homophoneResult - Homophone check result
 * @returns Combined constraints object
 *
 * @example
 * ```typescript
 * const constraints = buildConstraints(baziOutput, homophoneOutput);
 * // constraints.mustHave: ["氵", "木"]
 * // constraints.avoid: ["火", "默"]
 * ```
 */
export function buildConstraints(
  baziResult: AgentOutput<BaziData>,
  homophoneResult: AgentOutput<HomophoneData>
): Constraints {
  const constraints: Constraints = {
    mustHave: [],
    avoid: []
  };

  // From Bazi analysis - extract radical recommendations
  if (baziResult.status === "success" && baziResult.data) {
    constraints.mustHave = baziResult.data.recommendedRadicals || [];
    constraints.avoid = [...(baziResult.data.avoidRadicals || [])];
  }

  // From Homophone check - add forbidden characters
  if (homophoneResult.status === "success" && homophoneResult.data) {
    constraints.avoid = [...(constraints.avoid || []), ...(homophoneResult.data.forbiddenChars || [])];
  }

  return constraints;
}

/**
 * Creates a new shared context for a generation session
 *
 * @param userInput - Validated user input
 * @returns New context with session ID
 *
 * @example
 * ```typescript
 * const context = createContext(userInput);
 * // context.sessionId: "1710662400000-abc123"
 * // context.userInput: userInput
 * ```
 */
export function createContext(userInput: UserInput): SharedContext {
  return {
    sessionId: generateSessionId(),
    userInput,
  };
}

/**
 * Checks if a user is premium based on invite code usage
 *
 * Premium users (those who provided a valid invite code)
 * receive additional features like English name suggestions.
 *
 * @param context - Shared context with user input
 * @returns True if user provided an invite code
 *
 * @example
 * ```typescript
 * const isPremium = isPremiumUser(context);
 * if (isPremium) {
 *   // Enable English name generation
 * }
 * ```
 */
export function isPremiumUser(context: SharedContext): boolean {
  return !!context.userInput.inviteCode;
}

/**
 * Validates user input for required fields and formats
 *
 * Checks:
 * - Father name: at least 2 characters
 * - Mother name: at least 2 characters
 * - Children: at least one child with valid gender and birth time
 *
 * @param input - User input to validate
 * @returns Validation result with error messages
 *
 * @example
 * ```typescript
 * const validation = validateInput(input);
 * if (!validation.valid) {
 *   console.error(validation.errors);
 * }
 * ```
 */
export function validateInput(input: UserInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate father name
  if (!input.fatherName || input.fatherName.trim().length < 2) {
    errors.push("父亲姓名至少 2 个字");
  }

  // Validate mother name
  if (!input.motherName || input.motherName.trim().length < 2) {
    errors.push("母亲姓名至少 2 个字");
  }

  // Validate children array
  if (!input.children || input.children.length === 0) {
    errors.push("至少需要一个子女信息");
  } else {
    // Validate each child
    for (const child of input.children) {
      if (!child.gender || !["male", "female"].includes(child.gender)) {
        errors.push("子女性别必须是 male 或 female");
      }
      // Validate birth time fields (year, month, day, hour)
      if (!child.birthYear || !child.birthMonth || !child.birthDay || !child.birthHour) {
        errors.push("子女出生时间（年月日时）必须完整填写");
      }
      // Validate month range
      if (child.birthMonth && (child.birthMonth < 1 || child.birthMonth > 12)) {
        errors.push("出生月份必须在 1-12 之间");
      }
      // Validate day range
      if (child.birthDay && (child.birthDay < 1 || child.birthDay > 31)) {
        errors.push("出生日期必须在 1-31 之间");
      }
      // Validate hour format (00-23)
      if (child.birthHour && (parseInt(child.birthHour, 10) < 0 || parseInt(child.birthHour, 10) > 23)) {
        errors.push("出生时辰必须在 00-23 之间");
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
