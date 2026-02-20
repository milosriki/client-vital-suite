/**
 * 📚 Lisa's Expanded Knowledge Base — 50+ entries
 * Covers: Objections, Locations, Coaches, Packages, FAQs
 * Used by migrate-knowledge to seed + embed into knowledge_base table
 */

export const EXPANDED_KNOWLEDGE = [
  // ═══════════════════════════════════════
  // OBJECTION HANDLING (12)
  // ═══════════════════════════════════════
  {
    category: "objection",
    question: "I need to think about it",
    answer: "totally fair || here's what i usually see though — most people who say that end up pushing it another 3-6 months || the assessment is completely free, zero commitment || worst case you walk away with a blueprint of exactly what you need || shall i just lock in a slot before they fill up?",
    tags: ["objection", "think", "urgency"]
  },
  {
    category: "objection",
    question: "It's too expensive",
    answer: "i hear you || here's the thing — most clients spend more on coffee in a month than one PT session || and unlike coffee, this actually changes your body and energy permanently || plus we have flexible payment plans || let me show you options after your free assessment — sound fair?",
    tags: ["objection", "price", "value"]
  },
  {
    category: "objection",
    question: "I'll start next month",
    answer: "totally get it || but real talk — i've heard that from hundreds of people and 90% of them are still saying it 6 months later || the assessment is free and takes 30 min || what if we just do that now so you have a plan ready? no commitment",
    tags: ["objection", "delay", "momentum"]
  },
  {
    category: "objection",
    question: "I already have a gym membership",
    answer: "that's actually perfect || most of our clients train at their own gym || what personal training adds is the accountability, the program design, and having someone who actually tracks your progress || do you feel like you're getting results on your own right now?",
    tags: ["objection", "gym", "differentiation"]
  },
  {
    category: "objection",
    question: "I tried personal training before and it didn't work",
    answer: "i appreciate you being honest about that || can i ask what went wrong? || because a lot of the time it's about the coach fit, not the concept || our assessment specifically matches you with the right coach for your goals and personality || that alone makes a massive difference",
    tags: ["objection", "past_experience", "empathy"]
  },
  {
    category: "objection",
    question: "My schedule is too busy",
    answer: "i totally understand — most of our clients are executives and business owners || that's actually why we come to YOU || your building gym, your home, outdoor — wherever works || sessions are 45-60 min and we work around your calendar || what time of day usually works best for you?",
    tags: ["objection", "schedule", "flexibility"]
  },
  {
    category: "objection",
    question: "I want to do it on my own first",
    answer: "respect that || quick question though — how long have you been trying on your own? || because studies show people with a coach get 3x better results in half the time || the assessment is free — think of it as getting a roadmap. then you decide if you want to drive alone or with a navigator",
    tags: ["objection", "independence", "stats"]
  },
  {
    category: "objection",
    question: "Is it worth the money?",
    answer: "great question || our average client loses 8-12kg in 3 months and keeps it off || we've had clients reverse pre-diabetes, fix chronic back pain, and completely transform their confidence || but honestly the best way to judge is the free assessment — you'll see the quality firsthand",
    tags: ["objection", "value", "results"]
  },
  {
    category: "objection",
    question: "Can I try one session first?",
    answer: "even better — your first session IS the free Movement Assessment || it's a full 45-min session where the coach evaluates your movement, discusses your goals, and creates a custom plan || if you love it (most people do), we talk packages. if not, you keep the blueprint. fair?",
    tags: ["objection", "trial", "assessment"]
  },
  {
    category: "objection",
    question: "I need to ask my spouse/partner",
    answer: "of course || but here's what i'd suggest — book the free assessment now (it's literally free and no commitment) || that way when you discuss it, you have real info — your assessment results, the actual plan, pricing options || much better than guessing. make sense?",
    tags: ["objection", "spouse", "urgency"]
  },
  {
    category: "objection",
    question: "I'm not fit enough for a personal trainer",
    answer: "this is literally the #1 thing people say and it couldn't be more wrong || our coaches work with complete beginners every day || the assessment adapts to YOUR level || we've had clients start who couldn't do a single push-up and now they're crushing it || that's literally what we're here for",
    tags: ["objection", "fitness_level", "encouragement"]
  },
  {
    category: "objection",
    question: "I have an injury/medical condition",
    answer: "actually that's even MORE reason to work with a qualified trainer || our coaches are certified to work around injuries || the Movement Assessment specifically identifies limitations and creates a safe program || many clients come to us post-injury or with conditions like back pain, knee issues, etc",
    tags: ["objection", "injury", "safety"]
  },

  // ═══════════════════════════════════════
  // LOCATIONS (8)
  // ═══════════════════════════════════════
  {
    category: "location",
    question: "Dubai Marina area training",
    answer: "Dubai Marina is one of our most popular areas! We have multiple coaches covering Marina, JBR, and Bluewaters. Training can happen at your building gym, Marina Walk outdoors, or JBR beach area. Morning and evening slots available.",
    tags: ["location", "dubai_marina", "jbr"]
  },
  {
    category: "location",
    question: "Downtown Dubai area training",
    answer: "Downtown Dubai is fully covered — Burj Khalifa area, DIFC, Business Bay. Most clients train at their building gym or we use outdoor spaces. Several coaches specialize in this area with flexible scheduling.",
    tags: ["location", "downtown", "difc", "business_bay"]
  },
  {
    category: "location",
    question: "JLT and Sports City area training",
    answer: "JLT and Sports City area — we have coaches based nearby. Training at building gyms, Dubai Sports City facilities, or outdoor. Great area with lots of gym options in the towers.",
    tags: ["location", "jlt", "sports_city"]
  },
  {
    category: "location",
    question: "Abu Dhabi training locations",
    answer: "We cover Abu Dhabi! Corniche, Yas Island, Saadiyat, and Al Reem Island areas. We have dedicated Abu Dhabi coaches. Same quality, same methodology. The assessment is free in Abu Dhabi too.",
    tags: ["location", "abu_dhabi", "corniche", "yas"]
  },
  {
    category: "location",
    question: "Palm Jumeirah and Jumeirah area",
    answer: "Palm Jumeirah, Jumeirah Beach, Umm Suqeim — fully covered. Many of our coaches live in this area. Training at home, building gym, or beach/outdoor. Premium area with great outdoor training spots.",
    tags: ["location", "palm", "jumeirah"]
  },
  {
    category: "location",
    question: "Arabian Ranches and villa communities",
    answer: "Arabian Ranches, The Springs, Meadows, Emirates Hills — we cover all villa communities. Coaches come to your home gym, villa garden, or nearby community gym. Very popular for morning sessions.",
    tags: ["location", "arabian_ranches", "villas"]
  },
  {
    category: "location",
    question: "Dubai Hills and Al Barsha area",
    answer: "Dubai Hills Estate, Al Barsha, Motor City — all covered. Multiple coaches in this zone. Building gyms, Dubai Hills Mall area, and outdoor parks available for training.",
    tags: ["location", "dubai_hills", "al_barsha"]
  },
  {
    category: "location",
    question: "Do you cover my area?",
    answer: "We cover all of Dubai and Abu Dhabi! Major areas: Marina, Downtown, JBR, JLT, Palm, Jumeirah, Sports City, Dubai Hills, Arabian Ranches, Abu Dhabi Corniche, Yas Island, and more. Tell me your area and I'll match you with the closest coach.",
    tags: ["location", "coverage", "general"]
  },

  // ═══════════════════════════════════════
  // PACKAGES & PRICING (5)
  // ═══════════════════════════════════════
  {
    category: "pricing",
    question: "12 session package details",
    answer: "12-session package: AED 3,000 - 4,500 depending on coach level. That's roughly 3 sessions/week for a month or 2/week for 6 weeks. Great starter package to build habits and see initial results. Payment plans available.",
    tags: ["pricing", "packages", "12_sessions"]
  },
  {
    category: "pricing",
    question: "24 session package details",
    answer: "24-session package: AED 5,500 - 8,000. Our most popular package — 3 months of consistent training. This is where real transformation happens. Clients typically lose 8-12kg and build significant strength. Better value per session than the 12-pack.",
    tags: ["pricing", "packages", "24_sessions"]
  },
  {
    category: "pricing",
    question: "36 session package details",
    answer: "36-session package: AED 7,500 - 10,500. For serious commitment — 3 sessions/week for 3 months. Best results package. Includes nutrition guidance and progress tracking. Significant per-session discount.",
    tags: ["pricing", "packages", "36_sessions"]
  },
  {
    category: "pricing",
    question: "48 session package details",
    answer: "48-session package: AED 9,000 - 13,000. Our premium long-term transformation package. 4 months of dedicated training. Best value per session. Includes full nutrition plan, progress photos, and monthly assessments. Payment plans available.",
    tags: ["pricing", "packages", "48_sessions"]
  },
  {
    category: "pricing",
    question: "Payment plans and options",
    answer: "We offer flexible payment plans! You can split any package into 2-3 monthly payments. We accept bank transfer, credit card, and cash. The assessment is always FREE with zero commitment. After the assessment, your coach will present the options that fit your budget.",
    tags: ["pricing", "payment", "plans"]
  },

  // ═══════════════════════════════════════
  // FAQs (13)
  // ═══════════════════════════════════════
  {
    category: "faq",
    question: "What is a Movement Assessment?",
    answer: "A Movement Assessment is a free 45-minute session with one of our coaches. They evaluate your posture, movement patterns, flexibility, and strength. Then they discuss your goals and create a custom training plan. It's completely free, no commitment — you walk away with a blueprint either way.",
    tags: ["faq", "assessment", "free"]
  },
  {
    category: "faq",
    question: "How long are training sessions?",
    answer: "Sessions are typically 45-60 minutes. That includes warm-up, main workout, and cool-down. Your coach designs every session specifically for your goals and current fitness level. No cookie-cutter workouts.",
    tags: ["faq", "duration", "sessions"]
  },
  {
    category: "faq",
    question: "Do coaches come to my location?",
    answer: "Yes! That's what makes PTD different. Our coaches come to YOU — your building gym, home, outdoor space, or a partner gym near you. No need to commute to a specific gym. We train where it's convenient for you.",
    tags: ["faq", "location", "mobile"]
  },
  {
    category: "faq",
    question: "What if I travel frequently?",
    answer: "No problem! We can pause your package when you travel. Many of our clients are business travelers. Your coach can also create travel workouts you can do at hotel gyms. Sessions don't expire while you're away.",
    tags: ["faq", "travel", "flexibility"]
  },
  {
    category: "faq",
    question: "Can I pause or freeze my package?",
    answer: "Yes, packages can be paused for travel, illness, or personal reasons. Just let your coach know in advance. Sessions don't expire during the pause. We're flexible because life happens.",
    tags: ["faq", "pause", "freeze"]
  },
  {
    category: "faq",
    question: "Do you have male and female coaches?",
    answer: "Yes! We have both male and female coaches across all areas. If you have a preference, we'll match you accordingly. Many of our female clients prefer female coaches and we absolutely accommodate that.",
    tags: ["faq", "gender", "coaches"]
  },
  {
    category: "faq",
    question: "Do you offer online training?",
    answer: "Our focus is in-person training in Dubai and Abu Dhabi — that's where we deliver the best results. However, we can provide supplementary online programs for travel periods or as an add-on to your in-person sessions.",
    tags: ["faq", "online", "virtual"]
  },
  {
    category: "faq",
    question: "What results can I expect?",
    answer: "Results vary by commitment, but our average client: loses 8-12kg in 3 months, gains significant strength, improves energy and sleep quality, and builds sustainable habits. The key is consistency — that's what your coach ensures through accountability.",
    tags: ["faq", "results", "expectations"]
  },
  {
    category: "faq",
    question: "How do I cancel my package?",
    answer: "We hope it doesn't come to that! But if needed, speak with your coach or our team. Unused sessions can be discussed on a case-by-case basis. We always try to find a solution — different coach, schedule change, or pause — before cancellation.",
    tags: ["faq", "cancel", "refund"]
  },
  {
    category: "faq",
    question: "Do you have a referral program?",
    answer: "Yes! Refer a friend who signs up and you both get bonus sessions. It's our way of saying thanks. Just have your friend mention your name during their assessment. Our best clients come from referrals.",
    tags: ["faq", "referral", "bonus"]
  },
  {
    category: "faq",
    question: "What qualifications do your coaches have?",
    answer: "All PTD coaches are certified personal trainers with minimum 3+ years experience. Many hold specialist certifications in areas like rehabilitation, nutrition, strength & conditioning, and pre/post natal fitness. We vet every coach rigorously.",
    tags: ["faq", "qualifications", "coaches"]
  },
  {
    category: "faq",
    question: "Do you include nutrition guidance?",
    answer: "Yes! All packages include basic nutrition guidance from your coach. Larger packages (36+ sessions) include a detailed nutrition plan. We believe training and nutrition go hand in hand — you can't out-train a bad diet.",
    tags: ["faq", "nutrition", "diet"]
  },
  {
    category: "faq",
    question: "How quickly can I start?",
    answer: "Fast! Once you book your free Movement Assessment, we can usually schedule it within 24-48 hours. After the assessment, if you decide to go ahead, training can start the same week. We move quick because momentum matters.",
    tags: ["faq", "start", "timeline"]
  }
];
