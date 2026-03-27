/**
 * Integration tests for Agent Team (src/lib/team.ts)
 *
 * Note: This file tests the AgentTeam orchestration logic.
 * Uses dependency injection to mock runAgent for testing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SharedContext, UserInput, AgentOutput, BaziData, HomophoneData, PoetryData, HistoryData, EnglishData, NameScheme } from '../types';
import type { AgentConfig } from '../agents';
import { AgentTeam } from '../team';
import {
  BAZI_AGENT,
  HOMOPHONE_AGENT,
  POETRY_AGENT,
  HISTORY_AGENT,
  ENGLISH_AGENT,
  AGGREGATOR_AGENT,
} from '../agents';

describe('AgentTeam', () => {
  const TEST_API_KEY = 'test-api-key';
  const TEST_USER_INPUT: UserInput = {
    fatherName: '张伟',
    motherName: '李娜',
    children: [{ id: '1', gender: 'male', birthYear: 2024, birthMonth: 1, birthDay: 1, birthHour: '00' }],
  };

  const createContext = (inviteCode?: string): SharedContext => ({
    sessionId: 'test-session-123',
    userInput: { ...TEST_USER_INPUT, inviteCode },
  });

  const mockBaziData: AgentOutput<BaziData> = {
    status: 'success',
    data: {
      eightChars: '甲子 乙丑 丙寅 丁卯',
      fiveElements: '金木水火土',
      weakElements: ['金'],
      strongElements: ['木'],
      recommendedRadicals: ['氵', '木'],
      avoidRadicals: ['火'],
      summary: '八字分析完成',
    },
    notes: '',
  };

  const mockHomophoneData: AgentOutput<HomophoneData> = {
    status: 'success',
    data: { forbiddenChars: ['默'], riskCombinations: [], riskLevel: 'low', summary: '谐音检查完成' },
    notes: '',
  };

  const mockPoetryData: AgentOutput<PoetryData> = {
    status: 'success',
    data: { candidateChars: [{ char: '涵', source: 'poetry', level: '确凿出处', original: '涵虚混太清', meaning: '包容、涵养', radicals: ['氵'] }] },
    notes: '',
  };

  const mockHistoryData: AgentOutput<HistoryData> = {
    status: 'success',
    data: { candidateChars: [{ char: '伟', source: 'history', meaning: '伟大、卓越', historicalNote: '历史典故说明' }] },
    notes: '',
  };

  const mockEnglishData: AgentOutput<EnglishData> = {
    status: 'success',
    data: { candidateNames: [{ name: 'William', etymology: '古英语', meaning: '坚定的保护者', relationToChinese: '与「伟」字寓意相符', gender: 'male' }] },
    notes: '',
  };

  const createMockNameSchemes = (count: number, includeEnglish = false): NameScheme[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `scheme-${i}`,
      chineseName: `张${i}`,
      ...(includeEnglish ? { englishName: 'William' } : {}),
      coreMeaning: '寓意',
      baziAnalysis: '分析',
      homophoneCheck: { mandarin: 'safe' as const, dialects: [], english: 'safe' as const, overall: 'safe' as const },
      isPremium: includeEnglish,
    }));

  // Create a mock runAgent function factory
  const createMockRunAgent = () => {
    const mockFn = vi.fn<typeof import('../agents').runAgent>();
    return mockFn;
  };

  let mockRunAgent: ReturnType<typeof createMockRunAgent>;

  beforeEach(() => {
    mockRunAgent = createMockRunAgent();
  });

  const createTeam = () => {
    return new AgentTeam({ apiKey: TEST_API_KEY, runAgentFn: mockRunAgent });
  };

  describe('Instantiation', () => {
    it('should create an AgentTeam instance with API key', () => {
      const team = new AgentTeam({ apiKey: TEST_API_KEY });
      expect(team).toBeInstanceOf(AgentTeam);
    });

    it('should accept custom runAgent function for testing', () => {
      const customRunAgent = createMockRunAgent();
      const team = new AgentTeam({ apiKey: TEST_API_KEY, runAgentFn: customRunAgent });
      expect(team).toBeInstanceOf(AgentTeam);
    });
  });

  describe('generate() - Free User Flow', () => {
    it('should complete the three-round pipeline for free users', async () => {
      const mockSchemes = createMockNameSchemes(2, false);
      // Free users: 5 calls (Bazi, Homophone, Poetry, History, Aggregator)
      // No English agent call for free users
      mockRunAgent
        .mockResolvedValueOnce(mockBaziData)
        .mockResolvedValueOnce(mockHomophoneData)
        .mockResolvedValueOnce(mockPoetryData)
        .mockResolvedValueOnce(mockHistoryData)
        .mockResolvedValueOnce({ status: 'success', data: { nameSchemes: mockSchemes }, notes: '' });

      const team = createTeam();
      const context = createContext();
      const result = await team.generate(context);

      expect(result).toBeDefined();
      expect(result.length).toBe(2);
    });

    it('should limit free users to 2 name schemes', async () => {
      const manySchemes = createMockNameSchemes(5, false);
      mockRunAgent
        .mockResolvedValueOnce(mockBaziData)
        .mockResolvedValueOnce(mockHomophoneData)
        .mockResolvedValueOnce(mockPoetryData)
        .mockResolvedValueOnce(mockHistoryData)
        .mockResolvedValueOnce({ status: 'success', data: { nameSchemes: manySchemes }, notes: '' });

      const team = createTeam();
      const context = createContext();
      const result = await team.generate(context);

      expect(result.length).toBe(2);
    });

    it('should remove englishName for free users', async () => {
      const schemesWithEnglish: NameScheme[] = [{
        id: 'scheme-1',
        chineseName: '张涵',
        englishName: 'William',
        coreMeaning: '寓意',
        baziAnalysis: '分析',
        homophoneCheck: { mandarin: 'safe' as const, dialects: [], english: 'safe' as const, overall: 'safe' as const },
        isPremium: false,
      }];
      mockRunAgent
        .mockResolvedValueOnce(mockBaziData)
        .mockResolvedValueOnce(mockHomophoneData)
        .mockResolvedValueOnce(mockPoetryData)
        .mockResolvedValueOnce(mockHistoryData)
        .mockResolvedValueOnce({ status: 'success', data: { nameSchemes: schemesWithEnglish }, notes: '' });

      const team = createTeam();
      const context = createContext();
      const result = await team.generate(context);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].englishName).toBeDefined();
    });
  });

  describe('generate() - Premium User Flow', () => {
    it('should include English names for premium users', async () => {
      const mockSchemes = createMockNameSchemes(2, true);
      mockRunAgent
        .mockResolvedValueOnce(mockBaziData)
        .mockResolvedValueOnce(mockHomophoneData)
        .mockResolvedValueOnce(mockPoetryData)
        .mockResolvedValueOnce(mockHistoryData)
        .mockResolvedValueOnce(mockEnglishData)
        .mockResolvedValueOnce({ status: 'success', data: { nameSchemes: mockSchemes }, notes: '' });

      const team = createTeam();
      const context = createContext('AB12CD');
      const result = await team.generate(context);

      expect(result.length).toBe(2);
      expect(result[0].englishName).toBeDefined();
    });

    it('should not limit premium users to 2 schemes', async () => {
      const manySchemes = createMockNameSchemes(5, true);
      mockRunAgent
        .mockResolvedValueOnce(mockBaziData)
        .mockResolvedValueOnce(mockHomophoneData)
        .mockResolvedValueOnce(mockPoetryData)
        .mockResolvedValueOnce(mockHistoryData)
        .mockResolvedValueOnce(mockEnglishData)
        .mockResolvedValueOnce({ status: 'success', data: { nameSchemes: manySchemes }, notes: '' });

      const team = createTeam();
      const context = createContext('AB12CD');
      const result = await team.generate(context);

      expect(result.length).toBe(5);
    });
  });

  describe('Round 1 - Foundation Analysis', () => {
    it('should run Bazi and Homophone agents in parallel', async () => {
      const mockSchemes = createMockNameSchemes(2, false);
      // Free user flow: 5 calls (no English agent)
      mockRunAgent
        .mockResolvedValueOnce(mockBaziData)
        .mockResolvedValueOnce(mockHomophoneData)
        .mockResolvedValueOnce(mockPoetryData)
        .mockResolvedValueOnce(mockHistoryData)
        .mockResolvedValueOnce({ status: 'success', data: { nameSchemes: mockSchemes }, notes: '' });

      const team = createTeam();
      const context = createContext();
      await team.generate(context);

      // Free users: 5 calls (Bazi, Homophone, Poetry, History, Aggregator - no English)
      expect(mockRunAgent).toHaveBeenCalledTimes(5);
    });

    it('should call agents with correct configurations', async () => {
      const mockSchemes = createMockNameSchemes(2, false);
      mockRunAgent
        .mockResolvedValueOnce(mockBaziData)
        .mockResolvedValueOnce(mockHomophoneData)
        .mockResolvedValueOnce(mockPoetryData)
        .mockResolvedValueOnce(mockHistoryData)
        .mockResolvedValueOnce({ status: 'success', data: { nameSchemes: mockSchemes }, notes: '' });

      const team = createTeam();
      const context = createContext();
      await team.generate(context);

      // Verify first call uses BAZI_AGENT
      expect(mockRunAgent.mock.calls[0][0]).toEqual(BAZI_AGENT);
      // Verify second call uses HOMOPHONE_AGENT
      expect(mockRunAgent.mock.calls[1][0]).toEqual(HOMOPHONE_AGENT);
    });

    it('should call English agent for premium users (6 total calls)', async () => {
      const mockSchemes = createMockNameSchemes(2, true);
      mockRunAgent
        .mockResolvedValueOnce(mockBaziData)
        .mockResolvedValueOnce(mockHomophoneData)
        .mockResolvedValueOnce(mockPoetryData)
        .mockResolvedValueOnce(mockHistoryData)
        .mockResolvedValueOnce(mockEnglishData)
        .mockResolvedValueOnce({ status: 'success', data: { nameSchemes: mockSchemes }, notes: '' });

      const team = createTeam();
      const context = createContext('PREMIUM123');
      await team.generate(context);

      // Premium users: 6 calls (Bazi, Homophone, Poetry, History, English, Aggregator)
      expect(mockRunAgent).toHaveBeenCalledTimes(6);
    });
  });

  describe('Round 3 - Aggregation', () => {
    it('should throw error if aggregation fails', async () => {
      const failedAggregation: AgentOutput<never> = { status: 'failed', data: {} as never, notes: 'Aggregation failed' };
      // Premium user flow: 6 calls (with English agent)
      mockRunAgent
        .mockResolvedValueOnce(mockBaziData)
        .mockResolvedValueOnce(mockHomophoneData)
        .mockResolvedValueOnce(mockPoetryData)
        .mockResolvedValueOnce(mockHistoryData)
        .mockResolvedValueOnce(mockEnglishData)
        .mockResolvedValueOnce(failedAggregation);

      const team = createTeam();
      const context = createContext('AB12CD');

      await expect(team.generate(context)).rejects.toThrow('Aggregation failed');
    });

    it('should throw error if Round 1 results are missing', async () => {
      mockRunAgent
        .mockRejectedValueOnce(new Error('Bazi agent failed'))
        .mockResolvedValueOnce(mockHomophoneData);

      const team = createTeam();
      const context = createContext();

      await expect(team.generate(context)).rejects.toThrow('Bazi agent failed');
    });
  });
});
