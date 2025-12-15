import { supabase } from "@/integrations/supabase/client";

/**
 * Detects if there's test/mock data in the database
 * Returns true if test data is found
 */
export async function detectTestData(): Promise<{
  hasTestData: boolean;
  testDataCount: number;
  sources: string[];
}> {
  const sources: string[] = [];
  let totalCount = 0;

  try {
    // Check for test emails in contacts
    const { count: contactCount } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .or('email.ilike.%@example.com,email.ilike.%@email.com,email.ilike.%@test.com');

    if (contactCount && contactCount > 0) {
      sources.push('contacts');
      totalCount += contactCount;
    }

    // Check for test emails in leads
    const { count: leadCount } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .or('email.ilike.%@example.com,email.ilike.%@email.com,email.ilike.%@test.com');

    if (leadCount && leadCount > 0) {
      sources.push('leads');
      totalCount += leadCount;
    }

    // Check for test emails in enhanced_leads
    const { count: enhancedLeadCount } = await supabase
      .from('enhanced_leads')
      .select('*', { count: 'exact', head: true })
      .or('email.ilike.%@example.com,email.ilike.%@email.com,email.ilike.%@test.com');

    if (enhancedLeadCount && enhancedLeadCount > 0) {
      sources.push('enhanced_leads');
      totalCount += enhancedLeadCount;
    }

    // Check for test deals
    const { count: dealCount } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .or('deal_name.ilike.%test%,deal_name.ilike.%fake%,hubspot_deal_id.is.null');

    if (dealCount && dealCount > 0) {
      sources.push('deals');
      totalCount += dealCount;
    }

    return {
      hasTestData: sources.length > 0,
      testDataCount: totalCount,
      sources
    };
  } catch (error) {
    console.error('Error detecting test data:', error);
    return {
      hasTestData: false,
      testDataCount: 0,
      sources: []
    };
  }
}

/**
 * Clears all test/mock data from the database
 */
export async function clearTestData(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('sync-hubspot-to-supabase', {
      body: { clear_fake_data: true, sync_type: 'all' }
    });

    if (error) {
      throw error;
    }

    return {
      success: true,
      message: `Successfully synced ${data.contacts_synced} contacts, ${data.leads_synced} leads, ${data.deals_synced} deals from HubSpot`
    };
  } catch (error: any) {
    console.error('Error clearing test data:', error);
    return {
      success: false,
      message: error.message || 'Failed to clear test data'
    };
  }
}
