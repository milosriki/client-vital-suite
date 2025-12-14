// Agent Alignment Checker
// Verifies all agents use consistent stage mappings, data sources, and attribution logic

import { LEAD_LIFECYCLE_STAGES } from './lead-lifecycle-mapping';
import { UNIFIED_DATA_SCHEMA } from './unified-data-schema';

export interface AlignmentIssue {
  agent: string;
  issue_type: 'stage_mapping' | 'data_source' | 'attribution' | 'field_name';
  description: string;
  current_value: string;
  expected_value: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface AlignmentReport {
  total_agents_checked: number;
  total_issues: number;
  critical_issues: number;
  high_issues: number;
  medium_issues: number;
  low_issues: number;
  issues: AlignmentIssue[];
  recommendations: string[];
}

// Expected stage mappings (from unified schema)
const EXPECTED_STAGE_MAPPINGS = LEAD_LIFECYCLE_STAGES.DEAL_STAGES;
const EXPECTED_LIFECYCLE_STAGES = LEAD_LIFECYCLE_STAGES.LIFECYCLE_STAGES;

// Expected data sources (from unified schema)
const EXPECTED_DATA_SOURCES = {
  contacts: UNIFIED_DATA_SCHEMA.TABLES.CONTACTS,
  deals: UNIFIED_DATA_SCHEMA.TABLES.DEALS,
  calls: UNIFIED_DATA_SCHEMA.TABLES.CALLS,
  attribution: UNIFIED_DATA_SCHEMA.TABLES.ATTRIBUTION,
};

// Expected field names (from unified schema)
const EXPECTED_FIELD_NAMES = UNIFIED_DATA_SCHEMA.FIELDS;

// Expected attribution priority (from unified schema)
const EXPECTED_ATTRIBUTION_PRIORITY = 'anytrack > hubspot > facebook';

export async function checkAgentAlignment(
  agentCode: string,
  agentName: string
): Promise<AlignmentIssue[]> {
  const issues: AlignmentIssue[] = [];

  // Check 1: Stage Mappings
  // Look for hardcoded stage IDs that don't match expected mappings
  for (const [stageId, expectedName] of Object.entries(EXPECTED_STAGE_MAPPINGS)) {
    // Check if agent uses wrong mapping
    const wrongMappings = [
      { id: stageId, wrong: 'New Lead', correct: expectedName },
      { id: stageId, wrong: 'Assessment Booked', correct: expectedName },
    ];

    for (const mapping of wrongMappings) {
      if (mapping.wrong !== expectedName && agentCode.includes(`"${stageId}"`) && agentCode.includes(mapping.wrong)) {
        issues.push({
          agent: agentName,
          issue_type: 'stage_mapping',
          description: `Stage ID ${stageId} mapped incorrectly`,
          current_value: mapping.wrong,
          expected_value: expectedName,
          severity: 'high',
        });
      }
    }
  }

  // Check 2: Data Sources
  // Check if agent uses wrong table names
  const wrongTableNames = [
    { wrong: 'enhanced_leads', correct: 'contacts' },
    { wrong: 'hubspot_contacts', correct: 'contacts' },
  ];

  for (const table of wrongTableNames) {
    if (agentCode.includes(`from('${table.wrong}')`) || agentCode.includes(`.from("${table.wrong}")`)) {
      issues.push({
        agent: agentName,
        issue_type: 'data_source',
        description: `Uses wrong table name: ${table.wrong}`,
        current_value: table.wrong,
        expected_value: table.correct,
        severity: 'critical',
      });
    }
  }

  // Check 3: Attribution Fields
  // Check if agent uses wrong attribution field names
  const wrongAttributionFields = [
    { wrong: 'first_touch_source', correct: 'attribution_events.source (from AnyTrack)' },
    { wrong: 'latest_traffic_source', correct: 'attribution_events.source (from AnyTrack)' },
  ];

  for (const field of wrongAttributionFields) {
    if (agentCode.includes(field.wrong) && !agentCode.includes('attribution_events')) {
      issues.push({
        agent: agentName,
        issue_type: 'attribution',
        description: `Uses wrong attribution field: ${field.wrong}`,
        current_value: field.wrong,
        expected_value: field.correct,
        severity: 'medium',
      });
    }
  }

  // Check 4: Field Names
  // Check if agent uses non-standard field names
  const wrongFieldNames = [
    { wrong: 'lifecycleStage', correct: 'lifecycle_stage' },
    { wrong: 'dealStage', correct: 'stage' },
    { wrong: 'ownerId', correct: 'owner_id' },
  ];

  for (const field of wrongFieldNames) {
    if (agentCode.includes(field.wrong) && !agentCode.includes(field.correct)) {
      issues.push({
        agent: agentName,
        issue_type: 'field_name',
        description: `Uses non-standard field name: ${field.wrong}`,
        current_value: field.wrong,
        expected_value: field.correct,
        severity: 'low',
      });
    }
  }

  return issues;
}

export async function generateAlignmentReport(
  agentFiles: Array<{ name: string; path: string; content: string }>
): Promise<AlignmentReport> {
  const allIssues: AlignmentIssue[] = [];

  for (const agentFile of agentFiles) {
    const issues = await checkAgentAlignment(agentFile.content, agentFile.name);
    allIssues.push(...issues);
  }

  const criticalIssues = allIssues.filter(i => i.severity === 'critical');
  const highIssues = allIssues.filter(i => i.severity === 'high');
  const mediumIssues = allIssues.filter(i => i.severity === 'medium');
  const lowIssues = allIssues.filter(i => i.severity === 'low');

  const recommendations: string[] = [];

  if (criticalIssues.length > 0) {
    recommendations.push('CRITICAL: Fix data source issues immediately - agents using wrong tables');
  }

  if (highIssues.length > 0) {
    recommendations.push('HIGH: Update stage mappings to use unified schema');
  }

  if (mediumIssues.length > 0) {
    recommendations.push('MEDIUM: Update attribution logic to use AnyTrack as source of truth');
  }

  if (lowIssues.length > 0) {
    recommendations.push('LOW: Standardize field names across all agents');
  }

  if (allIssues.length === 0) {
    recommendations.push('✅ All agents are aligned with unified schema!');
  }

  return {
    total_agents_checked: agentFiles.length,
    total_issues: allIssues.length,
    critical_issues: criticalIssues.length,
    high_issues: highIssues.length,
    medium_issues: mediumIssues.length,
    low_issues: lowIssues.length,
    issues: allIssues,
    recommendations,
  };
}

// Export expected values for reference
export const EXPECTED_ALIGNMENT = {
  stage_mappings: EXPECTED_STAGE_MAPPINGS,
  lifecycle_stages: EXPECTED_LIFECYCLE_STAGES,
  data_sources: EXPECTED_DATA_SOURCES,
  field_names: EXPECTED_FIELD_NAMES,
  attribution_priority: EXPECTED_ATTRIBUTION_PRIORITY,
};
