/**
 * 📚 Lisa 7.0 Super-Brain Knowledge Base
 * Contains the extracted DNA from Jeremy Miner, Cole Gordon, and Jordan Belfort.
 * Used to seed the Supabase knowledge_base table.
 */

export const ELITE_SALES_PATTERNS = [
  // NEPQ (Jeremy Miner)
  {
    category: "Sales Framework",
    question: "How to start discovery?",
    answer: "Use the Clarifying Question: 'Help me understand... why are you actively looking for a shift right now? What changed recently?'",
    tags: ["NEPQ", "Discovery", "Opening"]
  },
  {
    category: "Sales Framework",
    question: "How to create urgency?",
    answer: "Use the Gap-Widening Question: 'If we don't fix this now, where are you physically in 6 months? Same spot?'",
    tags: ["NEPQ", "Urgency", "Gap"]
  },
  
  // Straight Line (Jordan Belfort)
  {
    category: "Sales Framework",
    question: "How to handle 'What is the price?' early?",
    answer: "Use the Price Deflection: 'totally fair question. here's the thing — pricing depends on what your coach maps out for you. that's why the assessment is free. worst case you walk away with a custom blueprint. can i ask you something quick to see if we're even a fit?'",
    tags: ["Belfort", "Objection", "Price"]
  },

  // Cole Gordon (Setter Framework)
  {
    category: "Sales Framework",
    question: "How to transition to booking?",
    answer: "The 'Next Step' Bridge: 'Based on what you've said, you're a perfect fit for our [Specific Program]. The next step is a quick 10-min Blueprint call to see if we can map this out. Are you open to that?'",
    tags: ["Cole Gordon", "Closing", "Booking"]
  }
];

export const FITNESS_ARCHETYPES = [
  // Post-Pregnancy
  {
    category: "Archetype",
    question: "Post-Pregnancy Linguistics",
    answer: "Focus: Rebuilding strength, reclaiming energy, feeling like yourself. Avoid: 'Baby weight', 'Getting body back'.",
    tags: ["Post-Pregnancy", "Empathy", "Women"]
  },
  // 40+ Executive
  {
    category: "Archetype",
    question: "40+ Executive Linguistics",
    answer: "Focus: Mobility, pain-free performance, posture, longevity. Avoid: 'Old', 'Weak', 'Bodybuilding'.",
    tags: ["Executive", "40+", "Men"]
  },
  // Skinny-Fat / Toning
  {
    category: "Archetype",
    question: "Skinny-Fat Linguistics",
    answer: "Focus: Metabolic fire, athletic physique, body composition. Avoid: 'Skinny-fat', 'Bulking'.",
    tags: ["Physique", "Gen Z", "Millennial"]
  }
];