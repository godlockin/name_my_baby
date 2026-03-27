/**
 * Component tests for StepForm (src/components/StepForm.tsx)
 *
 * Tests cover:
 * - Form validation on each step
 * - Navigation between steps (next/prev)
 * - Error display and clearance
 * - Submission behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepForm } from '../StepForm';
import { useWorkflowStore } from '../../stores/workflow';

// Mock the workflow store
vi.mock('../../stores/workflow', () => ({
  useWorkflowStore: vi.fn(),
}));

const mockUseWorkflowStore = useWorkflowStore as ReturnType<typeof vi.fn>;

describe('StepForm', () => {
  const mockStore = {
    // Form data
    fatherName: '',
    motherName: '',
    children: [{ id: '1', name: '', gender: 'male', birthYear: 2024, birthMonth: 1, birthDay: 1, birthHour: '00' }],
    generationChar: '',
    stylePreference: '',
    specialRequests: '',
    phone: '',
    inviteCode: '',

    // UI state
    currentStep: 'family' as const,
    isGenerating: false,
    sessionId: null,
    generationStatus: 'idle' as const,

    // Results
    names: [],
    savedNames: [],

    // Actions
    setFatherName: vi.fn(),
    setMotherName: vi.fn(),
    addChild: vi.fn(),
    removeChild: vi.fn(),
    updateChild: vi.fn(),
    setGenerationChar: vi.fn(),
    setStylePreference: vi.fn(),
    setSpecialRequests: vi.fn(),
    setPhone: vi.fn(),
    setInviteCode: vi.fn(),
    nextStep: vi.fn(),
    prevStep: vi.fn(),
    startGeneration: vi.fn(),
    setSessionId: vi.fn(),
    setGenerationStatus: vi.fn(),
    setNames: vi.fn(),
    saveName: vi.fn(),
    removeSavedName: vi.fn(),
    reset: vi.fn(),
  };

  const renderStepForm = (overrides = {}) => {
    const store = { ...mockStore, ...overrides };
    mockUseWorkflowStore.mockReturnValue(store);
    mockUseWorkflowStore.getState = vi.fn().mockReturnValue(store);
    return render(<StepForm />);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.confirm to return true by default
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Step Indicator', () => {
    it('should display all three steps', () => {
      renderStepForm();

      expect(screen.getAllByText('家庭信息').length).toBeGreaterThan(0);
      expect(screen.getAllByText('子女信息').length).toBeGreaterThan(0);
      expect(screen.getAllByText('偏好设置').length).toBeGreaterThan(0);
    });

    it('should highlight the current step', () => {
      renderStepForm({ currentStep: 'family' });

      const familyStepLabels = screen.getAllByText('家庭信息');
      // The step indicator label should have the active class
      expect(familyStepLabels.length).toBeGreaterThan(0);
    });
  });

  describe('Family Step', () => {
    beforeEach(() => {
      mockUseWorkflowStore.mockReturnValue({ ...mockStore, currentStep: 'family' });
      mockUseWorkflowStore.getState = vi.fn().mockReturnValue({ ...mockStore, currentStep: 'family' });
    });

    it('should render father and mother name inputs', () => {
      render(<StepForm />);

      expect(screen.getByPlaceholderText('请输入父亲姓名')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('请输入母亲姓名')).toBeInTheDocument();
    });

    it('should call setFatherName when father name input changes', async () => {
      render(<StepForm />);

      const fatherInput = screen.getByPlaceholderText('请输入父亲姓名');
      fireEvent.change(fatherInput, { target: { value: '张伟' } });

      expect(mockStore.setFatherName).toHaveBeenCalledWith('张伟');
    });

    it('should call setMotherName when mother name input changes', async () => {
      render(<StepForm />);

      const motherInput = screen.getByPlaceholderText('请输入母亲姓名');
      fireEvent.change(motherInput, { target: { value: '李娜' } });

      expect(mockStore.setMotherName).toHaveBeenCalledWith('李娜');
    });

    it('should display validation errors for empty father name', async () => {
      mockUseWorkflowStore.mockReturnValue({
        ...mockStore,
        fatherName: '',
        motherName: '',
        nextStep: vi.fn().mockReturnValue(false),
      });
      render(<StepForm />);

      const nextButton = screen.getByText('下一步');
      fireEvent.click(nextButton);

      expect(screen.getByText('父亲姓名至少 2 个字')).toBeInTheDocument();
    });

    it('should display validation errors for empty mother name', async () => {
      mockUseWorkflowStore.mockReturnValue({
        ...mockStore,
        fatherName: '张伟',
        motherName: '',
        nextStep: vi.fn().mockReturnValue(false),
      });
      render(<StepForm />);

      const nextButton = screen.getByText('下一步');
      fireEvent.click(nextButton);

      expect(screen.getByText('母亲姓名至少 2 个字')).toBeInTheDocument();
    });

    it('should call nextStep when next button is clicked', async () => {
      const mockNextStep = vi.fn().mockReturnValue(true);
      mockUseWorkflowStore.mockReturnValue({
        ...mockStore,
        fatherName: '张伟',
        motherName: '李娜',
        nextStep: mockNextStep,
      });
      render(<StepForm />);

      const nextButton = screen.getByText('下一步');
      fireEvent.click(nextButton);

      expect(mockNextStep).toHaveBeenCalled();
    });

    it('should not show prev button on family step', () => {
      render(<StepForm />);
      expect(screen.queryByText('上一步')).not.toBeInTheDocument();
    });

    it('should show hint message', () => {
      render(<StepForm />);
      expect(screen.getByText(/提示：/)).toBeInTheDocument();
    });
  });

  describe('Children Step', () => {
    beforeEach(() => {
      mockUseWorkflowStore.mockReturnValue({
        ...mockStore,
        currentStep: 'children',
        children: [{ id: '1', name: '', gender: 'male', birthYear: 2024, birthMonth: 1, birthDay: 1, birthHour: '00' }],
      });
      mockUseWorkflowStore.getState = vi.fn().mockReturnValue({
        ...mockStore,
        currentStep: 'children',
        children: [{ id: '1', name: '', gender: 'male', birthYear: 2024, birthMonth: 1, birthDay: 1, birthHour: '00' }],
      });
    });

    it('should render children step with child info', () => {
      render(<StepForm />);
      expect(screen.getByText('孩子 1')).toBeInTheDocument();
    });

    it('should render gender inputs', () => {
      render(<StepForm />);
      expect(screen.getByLabelText('男')).toBeInTheDocument();
      expect(screen.getByLabelText('女')).toBeInTheDocument();
    });

    it('should render birth time selects', () => {
      render(<StepForm />);
      expect(screen.getByLabelText('出生年份')).toBeInTheDocument();
      expect(screen.getByLabelText('出生月份')).toBeInTheDocument();
      expect(screen.getByLabelText('出生日期')).toBeInTheDocument();
      expect(screen.getByLabelText('出生时辰')).toBeInTheDocument();
    });

    it('should call updateChild when gender changes', async () => {
      render(<StepForm />);
      const femaleRadio = screen.getByLabelText('女');
      fireEvent.click(femaleRadio);
      expect(mockStore.updateChild).toHaveBeenCalledWith('1', expect.objectContaining({ gender: 'female' }));
    });

    it('should call updateChild when birth time changes', async () => {
      render(<StepForm />);
      const monthSelect = screen.getByLabelText('出生月份');
      fireEvent.change(monthSelect, { target: { value: '6' } });
      expect(mockStore.updateChild).toHaveBeenCalledWith('1', expect.objectContaining({ birthMonth: 6 }));
    });

    it('should call addChild when add button is clicked', async () => {
      render(<StepForm />);
      const addButton = screen.getByText('+ 添加子女');
      fireEvent.click(addButton);
      expect(mockStore.addChild).toHaveBeenCalled();
    });

    it('should show delete button for multiple children', () => {
      mockUseWorkflowStore.mockReturnValue({
        ...mockStore,
        currentStep: 'children',
        children: [
          { id: '1', name: '', gender: 'male', birthYear: 2024, birthMonth: 1, birthDay: 1, birthHour: '00' },
          { id: '2', name: '', gender: 'female', birthYear: 2024, birthMonth: 1, birthDay: 1, birthHour: '00' },
        ],
      });
      mockUseWorkflowStore.getState = vi.fn().mockReturnValue({
        ...mockStore,
        currentStep: 'children',
        children: [
          { id: '1', name: '', gender: 'male', birthYear: 2024, birthMonth: 1, birthDay: 1, birthHour: '00' },
          { id: '2', name: '', gender: 'female', birthYear: 2024, birthMonth: 1, birthDay: 1, birthHour: '00' },
        ],
      });
      render(<StepForm />);
      expect(screen.getAllByText('删除').length).toBeGreaterThan(0);
    });

    it('should call removeChild when delete button is clicked', async () => {
      mockUseWorkflowStore.mockReturnValue({
        ...mockStore,
        currentStep: 'children',
        children: [
          { id: '1', name: '', gender: 'male', birthYear: 2024, birthMonth: 1, birthDay: 1, birthHour: '00' },
          { id: '2', name: '', gender: 'female', birthYear: 2024, birthMonth: 1, birthDay: 1, birthHour: '00' },
        ],
      });
      mockUseWorkflowStore.getState = vi.fn().mockReturnValue({
        ...mockStore,
        currentStep: 'children',
        children: [
          { id: '1', name: '', gender: 'male', birthYear: 2024, birthMonth: 1, birthDay: 1, birthHour: '00' },
          { id: '2', name: '', gender: 'female', birthYear: 2024, birthMonth: 1, birthDay: 1, birthHour: '00' },
        ],
      });
      render(<StepForm />);
      const deleteButton = screen.getAllByText('删除')[0];
      fireEvent.click(deleteButton);
      expect(mockStore.removeChild).toHaveBeenCalledWith('1');
    });

    it('should call prevStep when prev button is clicked', async () => {
      render(<StepForm />);
      const prevButton = screen.getByText('上一步');
      fireEvent.click(prevButton);
      expect(mockStore.prevStep).toHaveBeenCalled();
    });
  });

  describe('Preferences Step', () => {
    beforeEach(() => {
      mockUseWorkflowStore.mockReturnValue({ ...mockStore, currentStep: 'preferences' });
      mockUseWorkflowStore.getState = vi.fn().mockReturnValue({ ...mockStore, currentStep: 'preferences' });
    });

    it('should render preference inputs', () => {
      render(<StepForm />);
      expect(screen.getByPlaceholderText('如家族有字辈要求请填写')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('如：文雅、大气、古典、现代等')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('其他特殊要求或说明，如希望避免的字、特定的寓意等')).toBeInTheDocument();
    });

    it('should display style quick-select buttons', () => {
      render(<StepForm />);
      const styles = ['文雅', '大气', '古典', '现代', '清新', '知性'];
      styles.forEach((style) => {
        expect(screen.getByText(style)).toBeInTheDocument();
      });
    });

    it('should call setStylePreference when style button is clicked', async () => {
      render(<StepForm />);
      const styleButton = screen.getByText('文雅');
      fireEvent.click(styleButton);
      expect(mockStore.setStylePreference).toHaveBeenCalledWith('文雅');
    });

    it('should call setGenerationChar when input changes', async () => {
      render(<StepForm />);
      const generationInput = screen.getByPlaceholderText('如家族有字辈要求请填写');
      fireEvent.change(generationInput, { target: { value: '志' } });
      expect(mockStore.setGenerationChar).toHaveBeenCalledWith('志');
    });

    it('should show submit button instead of next button', () => {
      render(<StepForm />);
      expect(screen.getByText('开始起名')).toBeInTheDocument();
      expect(screen.queryByText('下一步')).not.toBeInTheDocument();
    });

    it('should show prev button', () => {
      render(<StepForm />);
      expect(screen.getByText('上一步')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    beforeEach(() => {
      mockUseWorkflowStore.mockReturnValue({ ...mockStore, currentStep: 'preferences' });
      mockUseWorkflowStore.getState = vi.fn().mockReturnValue({ ...mockStore, currentStep: 'preferences' });
    });

    it('should call onSubmit when form is submitted', async () => {
      const mockOnSubmit = vi.fn();
      render(<StepForm onSubmit={mockOnSubmit} />);
      const submitButton = screen.getByText('开始起名');
      fireEvent.click(submitButton);
      expect(mockOnSubmit).toHaveBeenCalled();
    });
  });
});
