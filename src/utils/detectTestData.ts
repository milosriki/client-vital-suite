import { supabase } from "@/integrations/supabase/client";

/**
 * Comprehensive fake email patterns for detection
 */
const FAKE_EMAIL_PATTERNS = [
  '%@example.com',
  '%@email.com',
  '%@test.com',
  '%@fake.com',
  '%@dummy.com',
  '%@sample.com',
  '%@testing.com',
  '%@localhost%',
  'test%@%',
  'fake%@%',
  'dummy%@%',
  'sample%@%',
  'noreply%@%',
  'no-reply%@%',
  '%@mailinator.com',
  '%@guerrillamail.com',
  '%@10minutemail.com',
  '%@tempmail.com',
  '%@throwaway.email'
];

/**
 * Fake name patterns for detection
 */
const FAKE_NAME_PATTERNS = [
  'test%',
  'fake%',
  'dummy%',
  'sample%',
  '%test',
  '%fake',
  'john doe',
  'jane doe',
  'asdf%',
  'qwerty%'
];

export interface TestDataIssue {
  table: string;
  pattern: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
  sampleRecords: Array<{
    id?: string;
    email?: string;
    name?: string;
    deal_name?: string;
  }>;
}

export interface TestDataReport {
  hasTestData: boolean;
  totalCount: number;
  issues: TestDataIssue[];
  affectedTables: string[];
  summary: {
    byTable: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  recommendations: string[];
}

/**
 * Detects if there's test/mock data in the database
 * Returns detailed report with affected records
 */
export async function detectTestData(): Promise<TestDataReport> {
  const issues: TestDataIssue[] = [];
  const affectedTables = new Set<string>();
  let totalCount = 0;

  try {
    // Check contacts for fake emails
    for (const pattern of FAKE_EMAIL_PATTERNS.slice(0, 10)) { // Limit to avoid too many queries
      const { data, count } = await supabase
        .from('contacts')
        .select('id, email, first_name, last_name', { count: 'exact' })
        .ilike('email', pattern)
        .limit(5);

      if (count && count > 0) {
        affectedTables.add('contacts');
        totalCount += count;
        issues.push({
          table: 'contacts',
          pattern: pattern,
          count: count,
          severity: pattern.includes('test') || pattern.includes('fake') ? 'high' : 'medium',
          sampleRecords: (data || []).map(d => ({
            id: d.id,
            email: d.email,
            name: `${d.first_name} ${d.last_name}`
          }))
        });
      }
    }

    // Check contacts for fake names
    const { data: fakeNameContacts, count: fakeNameCount } = await supabase
      .from('contacts')
      .select('id, email, first_name, last_name', { count: 'exact' })
      .or('first_name.ilike.test%,first_name.ilike.fake%,last_name.ilike.test%,last_name.ilike.fake%')
      .limit(5);

    if (fakeNameCount && fakeNameCount > 0) {
      affectedTables.add('contacts');
      totalCount += fakeNameCount;
      issues.push({
        table: 'contacts',
        pattern: 'fake_names',
        count: fakeNameCount,
        severity: 'medium',
        sampleRecords: (fakeNameContacts || []).map(d => ({
          id: d.id,
          email: d.email,
          name: `${d.first_name} ${d.last_name}`
        }))
      });
    }

    // Check leads for fake emails
    for (const pattern of FAKE_EMAIL_PATTERNS.slice(0, 8)) {
      const { data, count } = await supabase
        .from('leads')
        .select('id, email, name', { count: 'exact' })
        .ilike('email', pattern)
        .limit(5);

      if (count && count > 0) {
        affectedTables.add('leads');
        totalCount += count;
        issues.push({
          table: 'leads',
          pattern: pattern,
          count: count,
          severity: pattern.includes('test') || pattern.includes('fake') ? 'high' : 'medium',
          sampleRecords: (data || []).map(d => ({
            id: d.id,
            email: d.email,
            name: d.name
          }))
        });
      }
    }

    // Check enhanced_leads for fake emails
    const { data: enhancedLeads, count: enhancedCount } = await supabase
      .from('enhanced_leads')
      .select('id, email', { count: 'exact' })
      .or('email.ilike.%@example.com,email.ilike.%@test.com,email.ilike.%@fake.com,email.ilike.test%@%')
      .limit(5);

    if (enhancedCount && enhancedCount > 0) {
      affectedTables.add('enhanced_leads');
      totalCount += enhancedCount;
      issues.push({
        table: 'enhanced_leads',
        pattern: 'multiple_fake_patterns',
        count: enhancedCount,
        severity: 'high',
        sampleRecords: (enhancedLeads || []).map(d => ({
          id: d.id,
          email: d.email
        }))
      });
    }

    // Check deals for test data
    const { data: testDeals, count: testDealCount } = await supabase
      .from('deals')
      .select('id, deal_name, hubspot_deal_id', { count: 'exact' })
      .or('deal_name.ilike.%test%,deal_name.ilike.%fake%,deal_name.ilike.%dummy%')
      .limit(5);

    if (testDealCount && testDealCount > 0) {
      affectedTables.add('deals');
      totalCount += testDealCount;
      issues.push({
        table: 'deals',
        pattern: 'test_deal_names',
        count: testDealCount,
        severity: 'medium',
        sampleRecords: (testDeals || []).map(d => ({
          id: d.id,
          deal_name: d.deal_name
        }))
      });
    }

    // Check deals without HubSpot IDs
    const { count: noHubSpotDeals } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .or('hubspot_deal_id.is.null,hubspot_deal_id.eq.');

    if (noHubSpotDeals && noHubSpotDeals > 0) {
      affectedTables.add('deals');
      totalCount += noHubSpotDeals;
      issues.push({
        table: 'deals',
        pattern: 'missing_hubspot_id',
        count: noHubSpotDeals,
        severity: 'low',
        sampleRecords: []
      });
    }

    // Check client_health_scores for fake emails
    const { data: fakeHealthScores, count: fakeHealthCount } = await supabase
      .from('client_health_scores')
      .select('email, firstname, lastname', { count: 'exact' })
      .or('email.ilike.%@example.com,email.ilike.%@test.com,email.ilike.%@fake.com')
      .limit(5);

    if (fakeHealthCount && fakeHealthCount > 0) {
      affectedTables.add('client_health_scores');
      totalCount += fakeHealthCount;
      issues.push({
        table: 'client_health_scores',
        pattern: 'fake_email_domains',
        count: fakeHealthCount,
        severity: 'high',
        sampleRecords: (fakeHealthScores || []).map(d => ({
          email: d.email,
          name: `${d.firstname} ${d.lastname}`
        }))
      });
    }

    // Generate summary
    const byTable: Record<string, number> = {};
    const bySeverity: Record<string, number> = { high: 0, medium: 0, low: 0 };

    for (const issue of issues) {
      byTable[issue.table] = (byTable[issue.table] || 0) + issue.count;
      bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + issue.count;
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (bySeverity.high > 0) {
      recommendations.push(`Found ${bySeverity.high} high-severity test records that should be removed immediately.`);
    }
    if (affectedTables.has('client_health_scores')) {
      recommendations.push('Test data in client_health_scores can affect health calculations and interventions.');
    }
    if (affectedTables.has('leads')) {
      recommendations.push('Test leads should be removed to ensure accurate lead tracking and reporting.');
    }
    if (totalCount > 0) {
      recommendations.push('Use the auto-fix option or run cleanup-fake-contacts function to remove test data.');
    }

    return {
      hasTestData: issues.length > 0,
      totalCount,
      issues,
      affectedTables: Array.from(affectedTables),
      summary: {
        byTable,
        bySeverity
      },
      recommendations
    };
  } catch (error) {
    console.error('Error detecting test data:', error);
    return {
      hasTestData: false,
      totalCount: 0,
      issues: [],
      affectedTables: [],
      summary: {
        byTable: {},
        bySeverity: { high: 0, medium: 0, low: 0 }
      },
      recommendations: ['Error occurred while detecting test data. Please check logs.']
    };
  }
}

/**
 * Auto-fix test data by removing it from the database
 */
export async function autoFixTestData(options: {
  tables?: string[];
  dryRun?: boolean;
} = {}): Promise<{
  success: boolean;
  message: string;
  deletedCount: number;
  details: Record<string, number>;
}> {
  const { tables = ['contacts', 'leads', 'enhanced_leads', 'client_health_scores'], dryRun = false } = options;

  try {
    // Use the cleanup-fake-contacts function
    const { data, error } = await supabase.functions.invoke('cleanup-fake-contacts', {
      body: { dry_run: dryRun, tables }
    });

    if (error) {
      throw error;
    }

    return {
      success: true,
      message: dryRun
        ? `Dry run complete. Would delete ${data.summary?.total_records_deleted || 0} records.`
        : `Successfully removed ${data.summary?.total_records_deleted || 0} test records.`,
      deletedCount: data.summary?.total_records_deleted || 0,
      details: data.fake_data_cleanup?.by_table || {}
    };
  } catch (error: unknown) {
    console.error('Error auto-fixing test data:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to auto-fix test data',
      deletedCount: 0,
      details: {}
    };
  }
}

/**
 * Clears all test/mock data from the database (legacy function, kept for compatibility)
 */
export async function clearTestData(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const result = await autoFixTestData({ dryRun: false });
    return {
      success: result.success,
      message: result.message
    };
  } catch (error: unknown) {
    console.error('Error clearing test data:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to clear test data'
    };
  }
}
