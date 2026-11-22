import type { CallLog, CustomerDocument, FollowUp, Lead, LeadScoreFactors, LeadScoreTier } from '../types/crm';

export interface ComputedLeadScore {
  leadScore: number;
  scoreTier: LeadScoreTier;
  scoreFactors: LeadScoreFactors;
  scoreSummary: string;
  scoreModel: string;
  scoredAt?: string;
}

const METRO_CITIES = new Set([
  'mumbai',
  'delhi',
  'new delhi',
  'bengaluru',
  'bangalore',
  'hyderabad',
  'chennai',
  'pune',
  'kolkata',
  'ahmedabad',
  'gurugram',
  'noida',
]);

export function computeBaselineLeadScore(
  lead: Pick<
    Lead,
    | 'city'
    | 'employmentType'
    | 'monthlyIncome'
    | 'requiredLoanAmount'
    | 'loanType'
    | 'leadSource'
    | 'status'
    | 'priority'
  >,
  calls: CallLog[] = [],
  followUps: FollowUp[] = [],
  docs: CustomerDocument[] = []
): ComputedLeadScore {
  // 1. Demographics (0 - 25)
  let demographics = 10;
  if (METRO_CITIES.has((lead.city || '').trim().toLowerCase())) demographics += 6;
  else demographics += 3;

  if (lead.employmentType === 'Salaried') demographics += 9;
  else if (lead.employmentType === 'Professional') demographics += 8;
  else if (lead.employmentType === 'Business Owner') demographics += 7;
  else demographics += 5;
  demographics = Math.min(25, Math.max(0, demographics));

  // 2. Financial Capacity (0 - 30)
  const monthly = Math.max(0, lead.monthlyIncome || 0);
  const annual = Math.max(1, monthly * 12);
  const ratio = (lead.requiredLoanAmount || 0) / annual;
  let financialCapacity = 0;

  if (monthly >= 150000) financialCapacity += 16;
  else if (monthly >= 85000) financialCapacity += 13;
  else if (monthly >= 50000) financialCapacity += 10;
  else if (monthly >= 30000) financialCapacity += 7;
  else financialCapacity += 4;

  const isSecured = lead.loanType === 'Home Loan' || lead.loanType === 'Loan Against Property';
  const maxComfortRatio = isSecured ? 6.0 : 2.5;
  if (ratio <= maxComfortRatio * 0.65) financialCapacity += 14;
  else if (ratio <= maxComfortRatio) financialCapacity += 11;
  else if (ratio <= maxComfortRatio * 1.4) financialCapacity += 6;
  else financialCapacity += 2;
  financialCapacity = Math.min(30, Math.max(0, financialCapacity));

  // 3. Lead Source Quality (0 - 15)
  const src = (lead.leadSource || '').toLowerCase();
  let sourceQuality = 7;
  if (src.includes('referral') || src.includes('partner') || src.includes('bank')) sourceQuality = 14;
  else if (src.includes('organic') || src.includes('website') || src.includes('branch')) sourceQuality = 12;
  else if (src.includes('whatsapp') || src.includes('inbound')) sourceQuality = 10;
  else if (src.includes('campaign') || src.includes('meta') || src.includes('google')) sourceQuality = 9;
  else if (src.includes('cold')) sourceQuality = 5;

  // 4. Interaction & Engagement History (0 - 30)
  let engagementHistory = 10;
  if (lead.status === 'Converted' || lead.status === 'Qualified') engagementHistory += 14;
  else if (lead.status === 'Interested') engagementHistory += 11;
  else if (lead.status === 'Callback Requested') engagementHistory += 7;
  else if (lead.status === 'Contacted') engagementHistory += 4;
  else if (lead.status === 'Not Interested' || lead.status === 'Lost') engagementHistory -= 8;

  const interestedCalls = calls.filter((c) => c.status === 'Interested').length;
  const connectedCalls = calls.filter((c) =>
    ['Connected', 'Interested', 'Callback Requested'].includes(c.status)
  ).length;
  const negativeCalls = calls.filter((c) =>
    ['Not Interested', 'Wrong Number'].includes(c.status)
  ).length;
  const completedFups = followUps.filter((f) => f.status === 'completed').length;
  const verifiedDocs = docs.filter((d) => d.status === 'Verified').length;

  engagementHistory += Math.min(6, interestedCalls * 3 + connectedCalls);
  engagementHistory += Math.min(4, completedFups * 2);
  engagementHistory += Math.min(4, verifiedDocs * 2 + (docs.length > 0 ? 1 : 0));
  engagementHistory -= Math.min(10, negativeCalls * 5);

  if (lead.priority === 'High') engagementHistory += 2;
  engagementHistory = Math.min(30, Math.max(0, engagementHistory));

  const leadScore = Math.min(100, Math.max(0, demographics + financialCapacity + sourceQuality + engagementHistory));
  const scoreTier: LeadScoreTier = leadScore >= 75 ? 'Hot' : leadScore >= 45 ? 'Warm' : 'Cold';

  const drivers: string[] = [];
  if (financialCapacity >= 22) drivers.push('strong income-to-loan ratio');
  if (demographics >= 20) drivers.push(`${lead.employmentType.toLowerCase()} metro profile`);
  if (sourceQuality >= 12) drivers.push(`high-intent ${lead.leadSource} channel`);
  if (engagementHistory >= 20) drivers.push('active call/follow-up engagement');
  else if (engagementHistory <= 8) drivers.push('low engagement or negative call outcome');

  const scoreSummary =
    drivers.length > 0
      ? `${scoreTier} lead (${leadScore}/100) driven by ${drivers.slice(0, 2).join(' and ')}.`
      : `${scoreTier} lead (${leadScore}/100) based on baseline income, source, and pipeline stage.`;

  return {
    leadScore,
    scoreTier,
    scoreFactors: {
      demographics,
      financialCapacity,
      sourceQuality,
      engagementHistory,
    },
    scoreSummary,
    scoreModel: 'quantitative-v1',
  };
}

export function resolveEffectiveLeadScore(
  lead: Lead,
  allCalls: CallLog[] = [],
  allFollowUps: FollowUp[] = [],
  allDocs: CustomerDocument[] = []
): ComputedLeadScore {
  if (typeof lead.leadScore === 'number' && lead.scoreFactors && lead.scoreTier) {
    return {
      leadScore: lead.leadScore,
      scoreTier: lead.scoreTier,
      scoreFactors: lead.scoreFactors,
      scoreSummary: lead.scoreSummary || 'Scored by CRM Lead Scoring Model.',
      scoreModel: lead.scoreModel || 'gemini-4-hydrogen',
      scoredAt: lead.scoredAt,
    };
  }
  const leadCalls = allCalls.filter((c) => c.leadId === lead.id);
  const leadFollowUps = allFollowUps.filter((f) => f.leadId === lead.id);
  const leadDocs = allDocs.filter((d) => d.leadId === lead.id);
  return computeBaselineLeadScore(lead, leadCalls, leadFollowUps, leadDocs);
}
