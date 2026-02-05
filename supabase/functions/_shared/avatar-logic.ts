export type AvatarType =
  | "MEN_40"
  | "MEN_50"
  | "WOMEN_40"
  | "WOMEN_50"
  | "MOMS"
  | "GENERAL";

const AVATAR_SCRIPTS: Record<AvatarType, string> = {
  MEN_40: `
  [AVATAR: MEN OVER 40 - "THE EXECUTIVE"]
  - Driver: Energy, Career Performance, Belly Fat.
  - Key Fear: "I don't have time."
  - TONE: Respectful, Efficient, Solution-Oriented.
  - SCRIPT CONCEPT: "Our system is built for your schedule. We come to you, saving 90 mins commute. Imagine having energy for that 3pm meeting."
  `,
  MEN_50: `
  [AVATAR: MEN OVER 50 - "VITALITY SEEKER"]
  - Driver: Longevity, Injury Prevention, Quality of Life.
  - Key Fear: "I'll get hurt."
  - TONE: Reassuring, Safety-First, Strategic.
  - SCRIPT CONCEPT: "Training smarter, not harder. Joint-friendly strength to bulletproof your back and knees. Movement screen first?"
  `,
  WOMEN_40: `
  [AVATAR: WOMEN OVER 40 - "CONFIDENCE RECLAIM"]
  - Driver: Hormonal Changes, Toning.
  - Key Fear: "Dieting doesn't work anymore."
  - TONE: Empathetic, Validating, Scientific (Hormones).
  - SCRIPT CONCEPT: "Hormones change the game. We work WITH your body, not against it. Reignite metabolic signals without starving."
  `,
  WOMEN_50: `
  [AVATAR: WOMEN OVER 50 - "VIBRANT AGING"]
  - Driver: Bone Health, Independence.
  - Key Fear: "Is this safe?"
  - TONE: Gentle, Encouraging, Celebrating.
  - SCRIPT CONCEPT: "New chapter! Strength is #1 for bone density. We start very gentle, in your own comfortable space."
  `,
  MOMS: `
  [AVATAR: MOMS - "HOT MOMMY MAKEOVER"]
  - Driver: Pre-Baby Body, Identity, Time.
  - Key Fear: "Neglecting kids."
  - TONE: Supportive, "From one parent to another".
  - SCRIPT CONCEPT: "Hardest job in the world. This is 45 mins to recharge YOU. We work around nap times."
  `,
  GENERAL: `
  [AVATAR: GENERAL]
  - Focus: Discovery and deeply understanding their specific goal.
  - TONE: Curious, Helpful, Professional.
  `,
};

export class AvatarLogic {
  static identify(contact: any): AvatarType {
    if (!contact || !contact.properties) return "GENERAL";

    const p = contact.properties;
    const gender = (p.gender || "unknown").toLowerCase();
    const age = parseInt(p.age || "35");
    const kids = parseInt(p.number_of_children || "0");
    const tags = (p.tags || "").toLowerCase();

    // 1. MOMS Check (Priority)
    if (
      gender === "female" &&
      (kids > 0 || tags.includes("mom") || tags.includes("postpartum"))
    ) {
      return "MOMS";
    }

    // 2. Age & Gender Segmentation
    if (gender === "male") {
      if (age >= 50) return "MEN_50";
      if (age >= 40) return "MEN_40";
    }

    if (gender === "female") {
      if (age >= 50) return "WOMEN_50";
      if (age >= 40) return "WOMEN_40";
    }

    return "GENERAL";
  }

  static getInstruction(avatar: AvatarType): string {
    return AVATAR_SCRIPTS[avatar];
  }
}

export class DubaiContext {
  static getContext(cityInput: string): string {
    const city = (cityInput || "").toLowerCase();

    if (city.includes("marina") || city.includes("jbr")) {
      return `
      [DUBAI CONTEXT: MARINA / JBR]
      - Vibe: "Beach Body", "Social Scene".
      - Reference: "Zero Gravity runs" or "Walks on the Walk".
      - Best Slots: Early Morning (6-7am) or Evening (7-8pm).
      - Advice: "Perfect for busy Marina life. Avoid the traffic."
      `;
    }

    if (
      city.includes("difc") ||
      city.includes("downtown") ||
      city.includes("business bay")
    ) {
      return `
      [DUBAI CONTEXT: DIFC / DOWNTOWN]
      - Vibe: "Executive", "High Performance".
      - Reference: "Boardroom Energy", "DIFC Gate".
      - Best Slots: Pre-Market (5:45am - 6:30am).
      - Advice: "Start before the market opens. Crush the day."
      `;
    }

    if (
      city.includes("ranches") ||
      city.includes("springs") ||
      city.includes("villa") ||
      city.includes("hills")
    ) {
      return `
      [DUBAI CONTEXT: VILLAS (Ranches, Springs, Hills)]
      - Vibe: "Family", "Privacy", "School Run".
      - Reference: "School drop-off", "Community feel".
      - Best Slots: Post-School Run (9:30am - 10am).
      - Advice: "We come to your privacy. No gym commute."
      `;
    }

    return `
    [DUBAI CONTEXT: GENERAL]
    - Advice: "We save you the commute by coming to you."
    - Slots: Ask for Morning or Evening preference.
    `;
  }
}
