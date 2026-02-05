export type SalesStage =
  | "1_CONNECTION"
  | "2_SITUATION"
  | "3_PROBLEM"
  | "4_SOLUTION"
  | "5_CLOSING"
  | "6_BOOKED";

const salesStages: Record<
  string,
  { description: string; goal: string; next_stage?: string; triggers: string[] }
> = {
  "1_CONNECTION": {
    description: "Initial contact and rapport building",
    goal: "Get response and identify primary interest (Weight Loss vs Muscle)",
    next_stage: "2_SITUATION",
    triggers: ["lose weight", "muscle", "strength", "shredded", "tone"],
  },
  "2_SITUATION": {
    description: "Understanding their current routine and failures",
    goal: "Find out what they are currently doing",
    next_stage: "3_PROBLEM",
    triggers: ["gym", "home workouts", "nothing", "diet", "tried before"],
  },
  "3_PROBLEM": {
    description: "Identifying the pain and obstacles",
    goal: "Get them to admit why previous attempts failed",
    next_stage: "4_SOLUTION",
    triggers: ["inconsistent", "don't know how", "lazy", "food", "time"],
  },
  "4_SOLUTION": {
    description: "Visualizing the future success",
    goal: "Get them to state their 90-day goal clearly",
    next_stage: "5_CLOSING",
    triggers: ["10kg", "pack", "feel better", "confident", "bikini"],
  },
  "5_CLOSING": {
    description: "Presenting the offer and booking",
    goal: "Book a specific time slot",
    next_stage: "6_BOOKED",
    triggers: ["tuesday", "thursday", "book", "yes", "deal"],
  },
  "6_BOOKED": {
    description: "Call booked",
    goal: "Confirm details",
    triggers: [],
  },
};

export interface StageResult {
  stage: SalesStage;
  hasChanged: boolean;
  promptGoal: string;
}

export class StageDetector {
  /**
   * Determines the next stage based on user input and current stage.
   * Uses keyword matching defined in sales_stages.json.
   */
  static detect(currentStage: SalesStage, userText: string): StageResult {
    const stageConfig = salesStages[currentStage];

    if (!stageConfig) {
      // Fallback
      return {
        stage: "1_CONNECTION",
        hasChanged: true,
        promptGoal: salesStages["1_CONNECTION"].goal,
      };
    }

    const text = userText.toLowerCase();
    const triggers = stageConfig.triggers || [];
    const nextStage = stageConfig.next_stage as SalesStage;

    // Check if any trigger matches
    const matched = triggers.some((trigger) =>
      text.includes(trigger.toLowerCase()),
    );

    if (matched && nextStage && salesStages[nextStage]) {
      console.log(`🚀 NEPQ Stage Advanced: ${currentStage} -> ${nextStage}`);
      return {
        stage: nextStage,
        hasChanged: true,
        promptGoal: salesStages[nextStage].goal,
      };
    }

    // specific catch for "booked" or "scheduled" in Closing stage
    if (
      currentStage === "5_CLOSING" &&
      (text.includes("book") ||
        text.includes("schedule") ||
        text.includes("time") ||
        text.includes("yes"))
    ) {
      return {
        stage: "6_BOOKED",
        hasChanged: true,
        promptGoal: "Confirm booking details",
      };
    }

    return {
      stage: currentStage,
      hasChanged: false,
      promptGoal: stageConfig.goal,
    };
  }

  static getInitialStage(): StageResult {
    return {
      stage: "1_CONNECTION",
      hasChanged: true,
      promptGoal: salesStages["1_CONNECTION"].goal,
    };
  }
}
