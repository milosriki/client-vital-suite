// n8n Aggregator Function - Execute Once After Fetching Clients
// Place this in a Function node that executes once after fetching all clients

const clients = $input.all();

// Calculate company-wide metrics
const healthScores = clients.map(c => Number(c.json.health_score ?? 0));
const companyAvgScore = healthScores.reduce((a, b) => a + b, 0) / healthScores.length;
const sortedScores = [...healthScores].sort((a, b) => a - b);
const medianHealthScore = sortedScores[Math.floor(sortedScores.length / 2)];

// Standard deviation
const variance = healthScores.reduce((sum, score) => sum + Math.pow(score - companyAvgScore, 2), 0) / healthScores.length;
const healthScoreStdev = Math.sqrt(variance);

// Zone counts
const redCount = clients.filter(c => c.json.health_zone === 'RED').length;
const yellowCount = clients.filter(c => c.json.health_zone === 'YELLOW').length;
const greenCount = clients.filter(c => c.json.health_zone === 'GREEN').length;
const purpleCount = clients.filter(c => c.json.health_zone === 'PURPLE').length;

// Percentages
const totalClients = clients.length;
const redPct = ((redCount / totalClients) * 100).toFixed(1);
const companyRedPct = redPct; // Same as redPct for company-wide view

// Momentum indicators
const clientsImproving = clients.filter(c => c.json.momentum_indicator === 'ACCELERATING').length;
const clientsDeclining = clients.filter(c => c.json.momentum_indicator === 'DECELERATING').length;

// Attach aggregated data to each client
return clients.map(client => {
  const healthScore = Number(client.json.health_score ?? 0);
  const deviationFromAvg = (healthScore - companyAvgScore).toFixed(2);
  const riskScore = client.json.predictive_risk_score ?? client.json.churn_risk_score ?? 0;
  
  return {
    json: {
      ...client.json,
      // Company-wide metrics
      company_avg_score: companyAvgScore.toFixed(2),
      median_health_score: medianHealthScore.toFixed(2),
      health_score_stdev: healthScoreStdev.toFixed(2),
      
      // Zone distribution
      red_count: redCount,
      red_pct: redPct,
      company_red_pct: companyRedPct,
      yellow_count: yellowCount,
      green_count: greenCount,
      purple_count: purpleCount,
      
      // Momentum
      clients_improving: clientsImproving,
      clients_declining: clientsDeclining,
      
      // Individual client metrics
      deviation_from_avg: deviationFromAvg,
      score_vs_avg: deviationFromAvg, // Alias for deviation_from_avg
      risk_score: riskScore,
      csv_url: client.json.csv_url ?? '', // For CSV export URLs
      
      // Meta CAPI fields
      event_name: 'Purchase', // or dynamic based on client action
      currency: 'AED',
      event_id: client.json.client_id ?? client.json.email ?? Math.random().toString(36).slice(2),
      fbp: client.json.fbp ?? '',
      fbc: client.json.fbc ?? '',
      external_id: client.json.external_id ?? client.json.client_id ?? client.json.email ?? '',
      
      // Timestamp
      event_time: Math.floor(Date.now() / 1000),
      as_of: new Date().toISOString()
    }
  };
});
