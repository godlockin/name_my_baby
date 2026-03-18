import { create } from "zustand";
import type { NameScheme } from "../types";

interface ChildInfo {
  id: string;
  gender: "male" | "female";
  birthTime: string;
}

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

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  // Initial state
  fatherName: "",
  motherName: "",
  children: [{ id: "1", gender: "male", birthTime: "" }],
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
    set({
      children: [
        ...children,
        { id: `${children.length + 1}`, gender: "male", birthTime: "" },
      ],
    });
  },

  removeChild: (id) => {
    const children = get().children.filter((c) => c.id !== id);
    set({ children });
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
      const hasInvalidChild = children.some(
        (c) => !c.birthTime || !c.gender
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
    set({
      fatherName: "",
      motherName: "",
      children: [{ id: "1", gender: "male", birthTime: "" }],
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
}));
