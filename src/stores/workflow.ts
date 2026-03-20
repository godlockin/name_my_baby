import { create } from "zustand";
import type { NameScheme, ChildInfo } from "../types";

interface WorkflowState {
  // Form data
  fatherName: string;
  motherName: string;
  children: ChildInfo[];
  generationChar: string;
  stylePreference: string;
  specialRequests: string;
  phone: string;
  inviteCode: string;

  // UI state
  currentStep: "family" | "children" | "preferences";
  isGenerating: boolean;
  sessionId: string | null;
  generationStatus: "idle" | "processing" | "completed" | "failed";

  // Results
  names: NameScheme[];
  savedNames: NameScheme[];

  // Actions
  setFatherName: (name: string) => void;
  setMotherName: (name: string) => void;
  addChild: () => void;
  removeChild: (id: string) => void;
  updateChild: (id: string, data: Partial<ChildInfo>) => void;
  setGenerationChar: (char: string) => void;
  setStylePreference: (pref: string) => void;
  setSpecialRequests: (req: string) => void;
  setPhone: (phone: string) => void;
  setInviteCode: (code: string) => void;
  nextStep: () => boolean;
  prevStep: () => void;
  startGeneration: () => void;
  setSessionId: (id: string) => void;
  setGenerationStatus: (status: "idle" | "processing" | "completed" | "failed") => void;
  setNames: (names: NameScheme[]) => void;
  saveName: (name: NameScheme) => void;
  removeSavedName: (id: string) => void;
  reset: () => void;
}

// Helper function to get current date/time
function getCurrentDateTime() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1, // 0-indexed, so add 1
    day: now.getDate(),
    hour: now.getHours().toString().padStart(2, "0"),
  };
}

export const useWorkflowStore = create<WorkflowState>((set, get) => {
  // Get current date/time for default values
  const { year, month, day, hour } = getCurrentDateTime();

  // Initial state
  return {
    fatherName: "",
    motherName: "",
    children: [{
      id: "1",
      name: "",
      gender: "male",
      birthYear: year,
      birthMonth: month,
      birthDay: day,
      birthHour: hour,
    }],
    generationChar: "",
    stylePreference: "",
    specialRequests: "",
    phone: "",
    inviteCode: "",

    currentStep: "family",
    isGenerating: false,
    sessionId: null,
    generationStatus: "idle",

    names: [],
    savedNames: [],

    // Actions
    setFatherName: (name) => set({ fatherName: name }),

    setMotherName: (name) => set({ motherName: name }),

    addChild: () => {
      const children = get().children;
      if (children.length >= 4) return; // Max 4 children
      const { year, month, day, hour } = getCurrentDateTime();
      set({
        children: [
          ...children,
          {
            id: `${Date.now()}`,
            name: "",
            gender: "male",
            birthYear: year,
            birthMonth: month,
            birthDay: day,
            birthHour: hour,
          },
        ],
      });
    },

    removeChild: (id) => {
      const children = get().children;
      if (children.length <= 1) return; // Keep at least 1 child
      set({ children: children.filter((c) => c.id !== id) });
    },

    updateChild: (id, data) => {
      const children = get().children.map((c) =>
        c.id === id ? { ...c, ...data } : c
      );
      set({ children });
    },

    setGenerationChar: (char) => set({ generationChar: char }),

    setStylePreference: (pref) => set({ stylePreference: pref }),

    setSpecialRequests: (req) => set({ specialRequests: req }),

    setPhone: (phone) => set({ phone }),

    setInviteCode: (code) => set({ inviteCode: code }),

    nextStep: () => {
      const { currentStep, fatherName, motherName, children } = get();

      // Validate current step
      if (currentStep === "family") {
        if (!fatherName || fatherName.length < 2) return false;
        if (!motherName || motherName.length < 2) return false;
      }

      if (currentStep === "children") {
        // Name is now optional, only validate gender and birth info
        const hasInvalidChild = children.some(
          (c) => !c.gender || !c.birthYear || !c.birthMonth || !c.birthDay || !c.birthHour
        );
        if (hasInvalidChild) return false;
      }

      // Move to next step
      if (currentStep === "family") {
        set({ currentStep: "children" });
      } else if (currentStep === "children") {
        set({ currentStep: "preferences" });
      }
      return true;
    },

    prevStep: () => {
      const { currentStep } = get();
      if (currentStep === "children") {
        set({ currentStep: "family" });
      } else if (currentStep === "preferences") {
        set({ currentStep: "children" });
      }
    },

    startGeneration: () => {
      set({ isGenerating: true, generationStatus: "processing" });
    },

    setSessionId: (id) => set({ sessionId: id }),

    setGenerationStatus: (status) => set({ generationStatus: status, isGenerating: status === "processing" }),

    setNames: (names: NameScheme[]) => set({ names }),

    saveName: (name: NameScheme) => {
      const saved = get().savedNames;
      if (!saved.find((n) => n.id === name.id)) {
        set({ savedNames: [...saved, name] });
      }
    },

    removeSavedName: (id) => {
      set({ savedNames: get().savedNames.filter((n) => n.id !== id) });
    },

    reset: () => {
      const { year, month, day, hour } = getCurrentDateTime();
      set({
        fatherName: "",
        motherName: "",
        children: [{
          id: "1",
          name: "",
          gender: "male",
          birthYear: year,
          birthMonth: month,
          birthDay: day,
          birthHour: hour,
        }],
        generationChar: "",
        stylePreference: "",
        specialRequests: "",
        phone: "",
        inviteCode: "",
        currentStep: "family",
        isGenerating: false,
        sessionId: null,
        generationStatus: "idle",
        names: [],
        savedNames: [],
      });
    },
  };
});
