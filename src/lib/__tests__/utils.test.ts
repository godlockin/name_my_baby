/**
 * Unit tests for utility functions (src/lib/utils.ts)
 *
 * Tests cover:
 * - ID generation (sessionId, childId, inviteCode)
 * - Input validation
 * - Constraint building
 * - Premium user detection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateSessionId,
  generateChildId,
  generateInviteCode,
  buildConstraints,
  createContext,
  isPremiumUser,
  validateInput,
} from '../utils';
import type { UserInput, AgentOutput, BaziData, HomophoneData } from '../types';

describe('Utils - ID Generation', () => {
  describe('generateSessionId', () => {
    it('should generate a unique session ID with timestamp-random format', () => {
      const sessionId = generateSessionId();
      const parts = sessionId.split('-');

      expect(parts).toHaveLength(2);
      expect(parts[0]).toMatch(/^\d+$/); // timestamp is numeric
      expect(parts[1]).toMatch(/^[a-z0-9]+$/i); // random part is alphanumeric
    });

    it('should generate unique IDs on each call', () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();

      expect(id1).not.toBe(id2);
    });

    it('should have a reasonable length', () => {
      const sessionId = generateSessionId();
      // Format: timestamp (13 digits) + hyphen + random (7 chars) = ~21 chars
      expect(sessionId.length).toBeGreaterThanOrEqual(20);
      expect(sessionId.length).toBeLessThanOrEqual(25);
    });
  });

  describe('generateChildId', () => {
    it('should generate a random child ID', () => {
      const childId = generateChildId();

      expect(childId).toMatch(/^[a-z0-9]+$/i);
      expect(childId.length).toBeGreaterThanOrEqual(5);
    });

    it('should generate unique IDs on each call', () => {
      const id1 = generateChildId();
      const id2 = generateChildId();

      expect(id1).not.toBe(id2);
    });
  });

  describe('generateInviteCode', () => {
    it('should generate a 6-character invite code', () => {
      const code = generateInviteCode();
      expect(code).toHaveLength(6);
    });

    it('should follow the format: 2 letters + 2 digits + 2 letters', () => {
      const code = generateInviteCode();
      const match = code.match(/^([A-Z]{2})(\d{2})([A-Z]{2})$/);

      expect(match).toBeTruthy();
      expect(match?.[1]).toMatch(/^[A-Z]{2}$/); // First 2 letters
      expect(match?.[2]).toMatch(/^\d{2}$/); // Middle 2 digits
      expect(match?.[3]).toMatch(/^[A-Z]{2}$/); // Last 2 letters
    });

    it('should generate different codes on each call', () => {
      const codes = new Set();
      for (let i = 0; i < 10; i++) {
        codes.add(generateInviteCode());
      }
      // With random generation, we expect mostly unique codes
      expect(codes.size).toBeGreaterThanOrEqual(8);
    });
  });
});

describe('Utils - createContext', () => {
  it('should create a context with sessionId and userInput', () => {
    const userInput: UserInput = {
      fatherName: '张伟',
      motherName: '李娜',
      children: [{ id: '1', gender: 'male', birthTime: '2024-01-01T00:00:00Z' }],
    };

    const context = createContext(userInput);

    expect(context.sessionId).toBeDefined();
    expect(context.userInput).toEqual(userInput);
    expect(context.round1).toBeUndefined();
    expect(context.round2).toBeUndefined();
    expect(context.round3).toBeUndefined();
  });
});

describe('Utils - isPremiumUser', () => {
  it('should return true when inviteCode is provided', () => {
    const context = {
      sessionId: '123',
      userInput: {
        fatherName: '张伟',
        motherName: '李娜',
        children: [{ id: '1', gender: 'male', birthTime: '2024-01-01T00:00:00Z' }],
        inviteCode: 'AB12CD',
      },
    };

    expect(isPremiumUser(context)).toBe(true);
  });

  it('should return false when no inviteCode is provided', () => {
    const context = {
      sessionId: '123',
      userInput: {
        fatherName: '张伟',
        motherName: '李娜',
        children: [{ id: '1', gender: 'male', birthTime: '2024-01-01T00:00:00Z' }],
      },
    };

    expect(isPremiumUser(context)).toBe(false);
  });

  it('should return false when inviteCode is empty string', () => {
    const context = {
      sessionId: '123',
      userInput: {
        fatherName: '张伟',
        motherName: '李娜',
        children: [{ id: '1', gender: 'male', birthTime: '2024-01-01T00:00:00Z' }],
        inviteCode: '',
      },
    };

    expect(isPremiumUser(context)).toBe(false);
  });
});

describe('Utils - buildConstraints', () => {
  const createBaziResult = (
    recommendedRadicals: string[] = [],
    avoidRadicals: string[] = []
  ): AgentOutput<BaziData> => ({
    status: 'success',
    data: {
      eightChars: '甲子 乙丑 丙寅 丁卯',
      fiveElements: '金木水火土',
      weakElements: ['金'],
      strongElements: ['木'],
      recommendedRadicals,
      avoidRadicals,
      summary: '测试八字分析',
    },
    notes: '',
  });

  const createHomophoneResult = (
    forbiddenChars: string[] = []
  ): AgentOutput<HomophoneData> => ({
    status: 'success',
    data: {
      forbiddenChars,
      riskCombinations: [],
      riskLevel: 'low',
      summary: '测试谐音检查',
    },
    notes: '',
  });

  it('should build constraints from successful agent results', () => {
    const baziResult = createBaziResult(['氵', '木'], ['火']);
    const homophoneResult = createHomophoneResult(['默']);

    const constraints = buildConstraints(baziResult, homophoneResult);

    expect(constraints.mustHave).toEqual(['氵', '木']);
    expect(constraints.avoid).toContain('火');
    expect(constraints.avoid).toContain('默');
  });

  it('should handle empty recommendations', () => {
    const baziResult = createBaziResult([], []);
    const homophoneResult = createHomophoneResult([]);

    const constraints = buildConstraints(baziResult, homophoneResult);

    expect(constraints.mustHave).toEqual([]);
    expect(constraints.avoid).toEqual([]);
  });

  it('should handle failed agent results gracefully', () => {
    const baziResult: AgentOutput<BaziData> = {
      status: 'failed',
      data: {} as BaziData,
      notes: 'API error',
    };
    const homophoneResult: AgentOutput<HomophoneData> = {
      status: 'failed',
      data: {} as HomophoneData,
      notes: 'API error',
    };

    const constraints = buildConstraints(baziResult, homophoneResult);

    expect(constraints.mustHave).toEqual([]);
    expect(constraints.avoid).toEqual([]);
  });

  it('should combine avoid lists from both sources', () => {
    const baziResult = createBaziResult(['氵'], ['火', '金']);
    const homophoneResult = createHomophoneResult(['默', '语']);

    const constraints = buildConstraints(baziResult, homophoneResult);

    expect(constraints.mustHave).toEqual(['氵']);
    expect(constraints.avoid).toEqual(['火', '金', '默', '语']);
  });
});

describe('Utils - validateInput', () => {
  const createValidInput = (): UserInput => ({
    fatherName: '张伟',
    motherName: '李娜',
    children: [{ id: '1', gender: 'male', birthYear: 2024, birthMonth: 1, birthDay: 1, birthHour: '00' }],
  });

  describe('father name validation', () => {
    it('should pass with valid father name (2+ characters)', () => {
      const input = createValidInput();
      const result = validateInput(input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail with empty father name', () => {
      const input = { ...createValidInput(), fatherName: '' };
      const result = validateInput(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('父亲姓名至少 2 个字');
    });

    it('should fail with single character father name', () => {
      const input = { ...createValidInput(), fatherName: '张' };
      const result = validateInput(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('父亲姓名至少 2 个字');
    });

    it('should pass with whitespace-padded name (trimmed)', () => {
      const input = { ...createValidInput(), fatherName: '  张伟  ' };
      const result = validateInput(input);

      // The validation uses trim().length, so this should pass
      expect(result.valid).toBe(true);
    });
  });

  describe('mother name validation', () => {
    it('should pass with valid mother name (2+ characters)', () => {
      const input = createValidInput();
      const result = validateInput(input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail with empty mother name', () => {
      const input = { ...createValidInput(), motherName: '' };
      const result = validateInput(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('母亲姓名至少 2 个字');
    });

    it('should fail with single character mother name', () => {
      const input = { ...createValidInput(), motherName: '李' };
      const result = validateInput(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('母亲姓名至少 2 个字');
    });
  });

  describe('children validation', () => {
    it('should fail with empty children array', () => {
      const input = {
        ...createValidInput(),
        children: [] as UserInput['children'],
      };
      const result = validateInput(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('至少需要一个子女信息');
    });

    it('should fail with missing children array', () => {
      const input = {
        ...createValidInput(),
        children: undefined as unknown as UserInput['children'],
      };
      const result = validateInput(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('至少需要一个子女信息');
    });

    it('should fail with invalid child gender', () => {
      const input = {
        ...createValidInput(),
        children: [{ id: '1', gender: 'invalid' as unknown as 'male' | 'female', birthYear: 2024, birthMonth: 1, birthDay: 1, birthHour: '00' }],
      };
      const result = validateInput(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('子女性别必须是 male 或 female');
    });

    it('should fail with missing child gender', () => {
      const input = {
        ...createValidInput(),
        children: [{ id: '1', gender: '' as unknown as 'male' | 'female', birthYear: 2024, birthMonth: 1, birthDay: 1, birthHour: '00' }],
      };
      const result = validateInput(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('子女性别必须是 male 或 female');
    });

    it('should fail with missing birth time', () => {
      const input = {
        ...createValidInput(),
        children: [{ id: '1', gender: 'male', birthYear: 2024, birthMonth: 1, birthDay: 1, birthHour: '' }],
      };
      const result = validateInput(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('子女出生时间（年月日时）必须完整填写');
    });

    it('should pass with multiple valid children', () => {
      const input = {
        ...createValidInput(),
        children: [
          { id: '1', gender: 'male', birthYear: 2024, birthMonth: 1, birthDay: 1, birthHour: '00' },
          { id: '2', gender: 'female', birthYear: 2024, birthMonth: 6, birthDay: 15, birthHour: '12' },
        ],
      };
      const result = validateInput(input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail if any child has invalid data', () => {
      const input = {
        ...createValidInput(),
        children: [
          { id: '1', gender: 'male', birthYear: 2024, birthMonth: 1, birthDay: 1, birthHour: '00' },
          { id: '2', gender: 'female', birthYear: 2024, birthMonth: 6, birthDay: 15, birthHour: '' },
        ],
      };
      const result = validateInput(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('子女出生时间（年月日时）必须完整填写');
    });
  });

  describe('comprehensive validation', () => {
    it('should collect all errors in a single validation', () => {
      const input = {
        fatherName: '',
        motherName: '李',
        children: [{ id: '1', gender: 'invalid' as unknown as 'male' | 'female', birthYear: 2024, birthMonth: 1, birthDay: 1, birthHour: '' }],
      };
      const result = validateInput(input);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
      expect(result.errors).toContain('父亲姓名至少 2 个字');
      expect(result.errors).toContain('母亲姓名至少 2 个字');
      expect(result.errors).toContain('子女性别必须是 male 或 female');
      expect(result.errors).toContain('子女出生时间（年月日时）必须完整填写');
    });
  });
});
