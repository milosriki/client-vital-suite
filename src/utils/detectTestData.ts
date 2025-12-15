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
    const { data: testContacts } = await supabase
      .from('contacts')
      .select('email', { count: 'exact', head: false })
      .or('email.ilike.%@example.com,email.ilike.%@email.com,email.ilike.%@test.com')
      .limit(1);

    if (testContacts && testContacts.length > 0) {
      sources.push('contacts');
      totalCount += testContacts.length;
    }

    // Check for test emails in leads
    const { data: testLeads } = await supabase
      .from('leads')
      .select('email', { count: 'exact', head: false })
      .or('email.ilike.%@example.com,email.ilike.%@email.com,email.ilike.%555-0%')
      .limit(1);

    if (testLeads && testLeads.length > 0) {
      sources.push('leads');
      totalCount += testLeads.length;
    }

    // Check for test emails in enhanced_leads
    const { data: testEnhancedLeads } = await supabase
      .from('enhanced_leads')
      .select('email', { count: 'exact', head: false })
      .or('email.ilike.%@example.com,email.ilike.%@email.com')
      .limit(1);

    if (testEnhancedLeads && testEnhancedLeads.length > 0) {
      sources.push('enhanced_leads');
      totalCount += testEnhancedLeads.length;
    }

    // Check for test deals
    const { data: testDeals } = await supabase
      .from('deals')
      .select('deal_name', { count: 'exact', head: false })
      .or('deal_name.ilike.%test%,deal_name.ilike.%fake%,hubspot_deal_id.is.null')
      .limit(1);

    if (testDeals && testDeals.length > 0) {
      sources.push('deals');
      totalCount += testDeals.length;
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
