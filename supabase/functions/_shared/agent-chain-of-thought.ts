// ============= CHAIN-OF-THOUGHT VALIDATION (7→10) =============
// Structured reasoning with validation and anti-hallucination

export interface ReasoningStep {
  step: number;
  name: string;
  content: string;
  confidence: number;
  sources?: string[];
  validated?: boolean;
}

export interface ChainOfThought {
  query: string;
  steps: ReasoningStep[];
  conclusion: string;
  overall_confidence: number;
  citations: string[];
  warnings: string[];
  validated: boolean;
}

// Required reasoning structure
const REASONING_TEMPLATE = {
  steps: [
    { name: 'UNDERSTAND', description: 'What is the user asking? What data is needed?' },
    { name: 'PLAN', description: 'Which tools to use? What order?' },
    { name: 'GATHER', description: 'Execute tools, collect data with sources' },
    { name: 'ANALYZE', description: 'Connect data points, find patterns, identify root causes' },
    { name: 'CONCLUDE', description: 'Actionable insights with quantified impact' }
  ],
  required_elements: [
    'data_source',
    'timestamp',
    'confidence_level',
    'evidence'
  ]
};

// ============= GENERATE REASONING PROMPT =============
export function generateReasoningPrompt(): string {
  return `
=== MANDATORY CHAIN-OF-THOUGHT REASONING ===

You MUST follow this 5-step reasoning process for EVERY response:

**STEP 1: UNDERSTAND**
- What is the user actually asking?
- What type of data/analysis is needed?
- What time frame is relevant?
- What business context applies?

**STEP 2: PLAN**
- Which tools will provide the most relevant data?
- What order should tools be called?
- What knowledge base facts are relevant?
- Do I need to cross-reference multiple sources?

**STEP 3: GATHER** (with citations)
- Call tools and CITE every data point: "X clients in red zone (source: client_health_scores, query_time: 2024-12-14T10:30:00Z)"
- Cross-reference multiple data sources
- Verify data freshness - prefer data from last 7 days
- Check related entities (contacts → deals → calls)

**STEP 4: ANALYZE**
- Connect dots between different data points
- Look for patterns and anomalies
- Consider business context and implications
- Identify ROOT CAUSES, not just symptoms
- State confidence level: CONFIRMED (>90%), PROBABLE (70-90%), HYPOTHESIS (50-70%), INSUFFICIENT (<50%)

**STEP 5: CONCLUDE**
- Lead with the MOST IMPORTANT finding
- Provide SPECIFIC numbers with evidence
- Recommend CONCRETE next steps
- Quantify IMPACT in AED where possible
- Acknowledge any data gaps

=== ANTI-HALLUCINATION RULES ===

1. **CITE EVERY NUMBER**: Include source and timestamp
   ✅ "Churn rate: 8.2% (source: client_health_scores, 12/146 clients, queried: 10:30 UTC)"
   ❌ "Churn rate is around 8%"

2. **VERIFY BEFORE STATING**: If you haven't queried it, say "I need to query X"
   ✅ "Let me check the deals table for pipeline data..."
   ❌ "The pipeline shows..." (without actually querying)

3. **DISTINGUISH FACT VS INFERENCE**:
   ✅ "Based on the 45% drop in sessions, I HYPOTHESIZE the client may be disengaged"
   ❌ "The client is disengaged"

4. **ACKNOWLEDGE GAPS**:
   ✅ "Data incomplete: found UTM for 28/45 leads (62%)"
   ❌ (silently ignoring missing data)

5. **NEVER INVENT DATA**: If tool returns empty/error, say so
   ✅ "No call records found for this contact in the last 30 days"
   ❌ "The contact had several calls..."

=== RESPONSE FORMAT ===

Always structure your response with visible reasoning:

<thinking>
[Step 1: Understanding...]
[Step 2: Planning...]
</thinking>

<data_gathering>
[Tool calls and results with citations...]
</data_gathering>

<analysis confidence="[CONFIRMED/PROBABLE/HYPOTHESIS]">
[Your analysis with evidence...]
</analysis>

<conclusion>
[Final answer with specific recommendations and AED impact where applicable]
</conclusion>

<sources>
- [Source 1: table/function, timestamp]
- [Source 2: table/function, timestamp]
</sources>
`;
}

// ============= PARSE CHAIN-OF-THOUGHT =============
export function parseChainOfThought(response: string): ChainOfThought | null {
  const steps: ReasoningStep[] = [];
  const citations: string[] = [];
  const warnings: string[] = [];

  // Extract thinking section
  const thinkingMatch = response.match(/<thinking>([\s\S]*?)<\/thinking>/);
  if (thinkingMatch) {
    steps.push({
      step: 1,
      name: 'UNDERSTAND',
      content: thinkingMatch[1].trim(),
      confidence: 1.0,
      validated: true
    });
    steps.push({
      step: 2,
      name: 'PLAN',
      content: thinkingMatch[1].trim(),
      confidence: 1.0,
      validated: true
    });
  }

  // Extract data gathering section
  const dataMatch = response.match(/<data_gathering>([\s\S]*?)<\/data_gathering>/);
  if (dataMatch) {
    steps.push({
      step: 3,
      name: 'GATHER',
      content: dataMatch[1].trim(),
      confidence: 1.0,
      sources: extractCitations(dataMatch[1]),
      validated: true
    });
  }

  // Extract analysis section
  const analysisMatch = response.match(/<analysis\s+confidence="([^"]+)">([\s\S]*?)<\/analysis>/);
  if (analysisMatch) {
    const confidenceStr = analysisMatch[1].toUpperCase();
    const confidenceMap: Record<string, number> = {
      'CONFIRMED': 0.95,
      'PROBABLE': 0.8,
      'HYPOTHESIS': 0.6,
      'INSUFFICIENT': 0.3
    };
    steps.push({
      step: 4,
      name: 'ANALYZE',
      content: analysisMatch[2].trim(),
      confidence: confidenceMap[confidenceStr] || 0.5,
      validated: true
    });
  }

  // Extract conclusion section
  const conclusionMatch = response.match(/<conclusion>([\s\S]*?)<\/conclusion>/);
  let conclusion = '';
  if (conclusionMatch) {
    conclusion = conclusionMatch[1].trim();
    steps.push({
      step: 5,
      name: 'CONCLUDE',
      content: conclusion,
      confidence: steps[3]?.confidence || 0.7,
      validated: true
    });
  }

  // Extract sources
  const sourcesMatch = response.match(/<sources>([\s\S]*?)<\/sources>/);
  if (sourcesMatch) {
    const sourceLines = sourcesMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
    citations.push(...sourceLines.map(l => l.replace(/^-\s*/, '').trim()));
  }

  // Validate completeness
  if (steps.length < 3) {
    warnings.push('Incomplete reasoning: missing required steps');
  }

  if (citations.length === 0) {
    warnings.push('No data sources cited');
  }

  // Check for hallucination indicators
  const hallucIndicators = [
    /around \d+%/gi,        // Vague percentages
    /approximately/gi,      // Hedging without source
    /probably/gi,          // Speculation without marking
    /should be/gi,         // Assumptions
    /I think/gi            // Opinions without data
  ];

  for (const indicator of hallucIndicators) {
    if (indicator.test(response) && !response.includes('HYPOTHESIS')) {
      warnings.push(`Potential hallucination: "${response.match(indicator)?.[0]}" without confidence marking`);
    }
  }

  // Calculate overall confidence
  const stepConfidences = steps.map(s => s.confidence);
  const overallConfidence = stepConfidences.length > 0
    ? stepConfidences.reduce((a, b) => a * b, 1) ** (1 / stepConfidences.length)
    : 0;

  return {
    query: '', // To be filled by caller
    steps,
    conclusion,
    overall_confidence: overallConfidence,
    citations,
    warnings,
    validated: warnings.length === 0 && steps.length >= 4
  };
}

// ============= EXTRACT CITATIONS =============
function extractCitations(text: string): string[] {
  const citations: string[] = [];

  // Match patterns like (source: X, timestamp: Y) or [source: X]
  const sourcePatterns = [
    /\(source:\s*([^,)]+)(?:,\s*[^)]+)?\)/gi,
    /\[source:\s*([^\]]+)\]/gi,
    /from\s+(\w+(?:_\w+)*)\s+table/gi,
    /queried?\s+(\w+(?:_\w+)*)/gi
  ];

  for (const pattern of sourcePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      citations.push(match[1]);
    }
  }

  return [...new Set(citations)]; // Deduplicate
}

// ============= VALIDATE RESPONSE =============
export function validateResponse(
  response: string,
  toolsUsed: string[]
): { valid: boolean; issues: string[]; score: number } {
  const issues: string[] = [];
  let score = 100;

  // Check for structured reasoning
  const hasThinking = /<thinking>/i.test(response);
  const hasDataGathering = /<data_gathering>/i.test(response);
  const hasAnalysis = /<analysis/i.test(response);
  const hasConclusion = /<conclusion>/i.test(response);
  const hasSources = /<sources>/i.test(response);

  if (!hasThinking) {
    issues.push('Missing <thinking> section');
    score -= 15;
  }
  if (!hasDataGathering && toolsUsed.length > 0) {
    issues.push('Missing <data_gathering> section despite using tools');
    score -= 15;
  }
  if (!hasAnalysis) {
    issues.push('Missing <analysis> section');
    score -= 20;
  }
  if (!hasConclusion) {
    issues.push('Missing <conclusion> section');
    score -= 20;
  }
  if (!hasSources && toolsUsed.length > 0) {
    issues.push('Missing <sources> section');
    score -= 15;
  }

  // Check for citations in data
  const citationPatterns = /\(source:|source:|queried:/gi;
  const citationCount = (response.match(citationPatterns) || []).length;
  if (citationCount < toolsUsed.length) {
    issues.push(`Insufficient citations: ${citationCount} citations for ${toolsUsed.length} tool calls`);
    score -= 10;
  }

  // Check for confidence levels
  if (!/(CONFIRMED|PROBABLE|HYPOTHESIS|INSUFFICIENT)/i.test(response)) {
    issues.push('Missing confidence level indicator');
    score -= 10;
  }

  // Check for AED quantification (if applicable)
  if (/revenue|cost|value|price|aed|money/i.test(response) && !/AED\s*[\d,]+/i.test(response)) {
    issues.push('Financial discussion without AED quantification');
    score -= 5;
  }

  return {
    valid: score >= 70,
    issues,
    score: Math.max(0, score)
  };
}

// ============= ENFORCE REASONING =============
export function enforceReasoning(rawResponse: string): string {
  // If response doesn't have structured format, wrap it
  if (!/<thinking>/.test(rawResponse)) {
    return `
<thinking>
[Reasoning implicit in response]
</thinking>

<analysis confidence="PROBABLE">
${rawResponse}
</analysis>

<conclusion>
${rawResponse.split('\n').slice(-3).join('\n')}
</conclusion>

<sources>
- Response generated without explicit tool citations
</sources>
`;
  }

  return rawResponse;
}

// ============= REASONING SCORE CARD =============
export interface ReasoningScoreCard {
  structure_score: number;       // Format compliance (0-100)
  evidence_score: number;        // Data citation quality (0-100)
  confidence_score: number;      // Proper uncertainty handling (0-100)
  actionability_score: number;   // Concrete recommendations (0-100)
  overall_score: number;         // Weighted average
  feedback: string[];
}

export function scoreReasoning(response: string, toolsUsed: string[]): ReasoningScoreCard {
  const feedback: string[] = [];

  // Structure score
  let structureScore = 0;
  if (/<thinking>/.test(response)) structureScore += 25;
  if (/<data_gathering>/.test(response)) structureScore += 25;
  if (/<analysis/.test(response)) structureScore += 25;
  if (/<conclusion>/.test(response)) structureScore += 25;

  if (structureScore < 75) {
    feedback.push('Use complete reasoning structure: <thinking>, <data_gathering>, <analysis>, <conclusion>');
  }

  // Evidence score
  let evidenceScore = 100;
  const citations = (response.match(/\(source:|source:|queried:/gi) || []).length;
  const expectedCitations = Math.max(1, toolsUsed.length);
  const citationRatio = Math.min(1, citations / expectedCitations);
  evidenceScore = Math.round(citationRatio * 100);

  if (evidenceScore < 80) {
    feedback.push(`Add more citations: found ${citations}, expected ~${expectedCitations}`);
  }

  // Confidence score
  let confidenceScore = 0;
  if (/CONFIRMED/i.test(response)) confidenceScore += 25;
  if (/PROBABLE/i.test(response)) confidenceScore += 25;
  if (/HYPOTHESIS/i.test(response)) confidenceScore += 25;
  if (/INSUFFICIENT/i.test(response)) confidenceScore += 25;
  if (confidenceScore === 0) {
    // Check for implicit confidence language
    if (/definitely|certainly|clearly/i.test(response)) confidenceScore += 15;
    if (/likely|probably|appears/i.test(response)) confidenceScore += 10;
    feedback.push('Use explicit confidence markers: CONFIRMED, PROBABLE, HYPOTHESIS, or INSUFFICIENT');
  }

  // Actionability score
  let actionabilityScore = 0;
  if (/recommend|suggest|should|next step/i.test(response)) actionabilityScore += 30;
  if (/AED\s*[\d,]+/i.test(response)) actionabilityScore += 30;
  if (/\d+%/i.test(response)) actionabilityScore += 20;
  if (/immediately|urgent|priority/i.test(response)) actionabilityScore += 20;

  if (actionabilityScore < 60) {
    feedback.push('Add concrete recommendations with quantified impact (AED values, percentages)');
  }

  // Overall (weighted average)
  const overallScore = Math.round(
    structureScore * 0.25 +
    evidenceScore * 0.35 +
    confidenceScore * 0.20 +
    actionabilityScore * 0.20
  );

  return {
    structure_score: structureScore,
    evidence_score: evidenceScore,
    confidence_score: confidenceScore,
    actionability_score: actionabilityScore,
    overall_score: overallScore,
    feedback
  };
}
