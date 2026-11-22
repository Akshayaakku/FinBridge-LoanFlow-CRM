import { collection, doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { computeBaselineLeadScore } from '../lib/leadScoring';
import type {
  CallStatus,
  DocumentStatus,
  DocumentType,
  EmploymentType,
  LeadPriority,
  LeadStatus,
  LoanApplicationStatus,
  LoanType,
} from '../types/crm';

interface BatchOp {
  ref: ReturnType<typeof doc>;
  data: Record<string, unknown>;
}

async function commitInChunks(ops: BatchOp[]) {
  const CHUNK_SIZE = 380;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    const slice = ops.slice(i, i + CHUNK_SIZE);
    for (const op of slice) {
      batch.set(op.ref, op.data);
    }
    await batch.commit();
  }
}

function daysAgoIso(daysAgo: number, hourOffset = 10, minuteOffset = 15): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hourOffset, minuteOffset, 0, 0);
  return d.toISOString();
}

function hoursFromNowIso(hoursFromNow: number): string {
  const d = new Date(Date.now() + hoursFromNow * 3600 * 1000);
  return d.toISOString();
}

const DEMO_STAFF_LIST = [
  { name: 'Priya Nair', email: 'staff@loancrm.com', dept: 'Retail Loans', target: 45, phone: '+91 98100-10001' },
  { name: 'Rohan Verma', email: 'rohan.verma@loancrm.com', dept: 'Home Loans', target: 40, phone: '+91 98100-10002' },
  { name: 'Ananya Iyer', email: 'ananya.iyer@loancrm.com', dept: 'Personal Loans', target: 50, phone: '+91 98100-10003' },
  { name: 'Vikram Mehta', email: 'vikram.mehta@loancrm.com', dept: 'SME Business Desk', target: 35, phone: '+91 98100-10004' },
  { name: 'Sneha Kulkarni', email: 'sneha.kulkarni@loancrm.com', dept: 'Retail Loans', target: 45, phone: '+91 98100-10005' },
  { name: 'Arjun Deshmukh', email: 'arjun.deshmukh@loancrm.com', dept: 'Mortgage Desk', target: 40, phone: '+91 98100-10006' },
  { name: 'Kavya Reddy', email: 'kavya.reddy@loancrm.com', dept: 'Personal Loans', target: 50, phone: '+91 98100-10007' },
  { name: 'Siddharth Joshi', email: 'siddharth.joshi@loancrm.com', dept: 'Auto & Retail', target: 42, phone: '+91 98100-10008' },
  { name: 'Meera Krishnan', email: 'meera.krishnan@loancrm.com', dept: 'Home Loans', target: 40, phone: '+91 98100-10009' },
  { name: 'Aditya Malhotra', email: 'aditya.malhotra@loancrm.com', dept: 'SME Business Desk', target: 38, phone: '+91 98100-10010' },
  { name: 'Pooja Sharma', email: 'pooja.sharma@loancrm.com', dept: 'Personal Loans', target: 48, phone: '+91 98100-10011' },
  { name: 'Nikhil Bansal', email: 'nikhil.bansal@loancrm.com', dept: 'Retail Loans', target: 45, phone: '+91 98100-10012' },
  { name: 'Divya Menon', email: 'divya.menon@loancrm.com', dept: 'Priority Advisory', target: 35, phone: '+91 98100-10013' },
  { name: 'Karan Kapoor', email: 'karan.kapoor@loancrm.com', dept: 'Mortgage Desk', target: 40, phone: '+91 98100-10014' },
  { name: 'Riya Chatterjee', email: 'riya.chatterjee@loancrm.com', dept: 'Personal Loans', target: 50, phone: '+91 98100-10015' },
  { name: 'Harsh Vardhan', email: 'harsh.vardhan@loancrm.com', dept: 'Auto & Retail', target: 44, phone: '+91 98100-10016' },
  { name: 'Neha Agarwal', email: 'neha.agarwal@loancrm.com', dept: 'Home Loans', target: 42, phone: '+91 98100-10017' },
  { name: 'Tushar Patel', email: 'tushar.patel@loancrm.com', dept: 'SME Business Desk', target: 36, phone: '+91 98100-10018' },
  { name: 'Shruti Rao', email: 'shruti.rao@loancrm.com', dept: 'Retail Loans', target: 45, phone: '+91 98100-10019' },
  { name: 'Manish Tiwari', email: 'manish.tiwari@loancrm.com', dept: 'Priority Advisory', target: 40, phone: '+91 98100-10020' },
];

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Diya', 'Ananya', 'Saanvi', 'Aadhya', 'Kiara', 'Pari', 'Myra', 'Riya', 'Navya', 'Ira',
  'Pranav', 'Kabir', 'Rohan', 'Dhruv', 'Devansh', 'Nisha', 'Tanvi', 'Pooja', 'Shreya', 'Kriti',
];

const LAST_NAMES = [
  'Sharma', 'Patel', 'Reddy', 'Nair', 'Verma', 'Gupta', 'Iyer', 'Mehta', 'Kulkarni', 'Joshi',
  'Malhotra', 'Chatterjee', 'Deshmukh', 'Bansal', 'Kapoor', 'Rao', 'Agarwal', 'Tiwari', 'Menon', 'Saxena',
];

const CITIES = [
  { city: 'Mumbai', state: 'Maharashtra' },
  { city: 'Bengaluru', state: 'Karnataka' },
  { city: 'Hyderabad', state: 'Telangana' },
  { city: 'Pune', state: 'Maharashtra' },
  { city: 'Chennai', state: 'Tamil Nadu' },
  { city: 'Gurugram', state: 'Haryana' },
  { city: 'Ahmedabad', state: 'Gujarat' },
  { city: 'Delhi', state: 'Delhi NCR' },
  { city: 'Kolkata', state: 'West Bengal' },
  { city: 'Jaipur', state: 'Rajasthan' },
];

const LOAN_TYPES: LoanType[] = [
  'Home Loan',
  'Personal Loan',
  'Business Loan',
  'Auto Loan',
  'Education Loan',
  'Loan Against Property',
];

const EMPLOYMENT_TYPES: EmploymentType[] = [
  'Salaried',
  'Self-Employed',
  'Business Owner',
  'Professional',
];

const LEAD_SOURCES = ['Website Inquiry', 'Partner Referral', 'Meta Ads', 'Google Search', 'DSA Network', 'Aggregator Portal'];

const LEAD_STATUSES: LeadStatus[] = [
  'New',
  'Contacted',
  'Interested',
  'Not Interested',
  'Callback Requested',
  'Qualified',
  'Converted',
  'Lost',
];

const PRIORITIES: LeadPriority[] = ['High', 'Medium', 'Low'];

const CALL_STATUSES: CallStatus[] = [
  'Connected',
  'Not Connected',
  'Busy',
  'No Answer',
  'Interested',
  'Not Interested',
  'Callback Requested',
  'Wrong Number',
];

export async function seedDatabaseIfNeeded(actorUid: string, actorName: string, actorEmail: string): Promise<boolean> {
  try {
    const settingsRef = doc(db, 'settings', 'global');
    const existingSettings = await getDoc(settingsRef);
    if (existingSettings.exists() && existingSettings.data()?.seeded === true) {
      return false;
    }

    const ops: BatchOp[] = [];

    // 1. Settings
    ops.push({
      ref: settingsRef,
      data: {
        duplicateRule: 'phone_or_email',
        defaultDailyCallTarget: 45,
        roundRobinIndex: 0,
        seeded: true,
        updatedAt: serverTimestamp(),
      },
    });

    // 2. Admin directory record + 20 Staff Employees
    const adminEmpId = 'emp_admin_01';
    ops.push({
      ref: doc(db, 'employees', adminEmpId),
      data: {
        employeeCode: 'EMP-000',
        uid: actorUid,
        fullName: actorName || 'CRM Director',
        email: 'admin@loancrm.com',
        phone: '+91 98100-00001',
        role: 'admin',
        department: 'Executive Operations',
        joiningDate: '2024-01-15',
        status: 'active',
        dailyCallTarget: 20,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });

    const staffRecords = DEMO_STAFF_LIST.map((s, idx) => {
      const id = `emp_staff_${String(idx + 1).padStart(2, '0')}`;
      const code = `EMP-${String(idx + 1).padStart(3, '0')}`;
      ops.push({
        ref: doc(db, 'employees', id),
        data: {
          employeeCode: code,
          fullName: s.name,
          email: s.email,
          phone: s.phone,
          role: 'staff',
          department: s.dept,
          joiningDate: `2025-0${(idx % 9) + 1}-${String((idx % 20) + 5).padStart(2, '0')}`,
          status: idx === 19 ? 'inactive' : 'active',
          dailyCallTarget: s.target,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
      return { id, code, ...s };
    });

    // 3. Partner Banks (6)
    const banksSeed = [
      { id: 'bank_hdfc', name: 'HDFC Bank', shortCode: 'HDFC', logoColor: '#0F4C81', contactPerson: 'Rajeshwari Menon', contactNumber: '+91 22-6160-6161', email: 'channel.desk@hdfc-partner.test' },
      { id: 'bank_icici', name: 'ICICI Bank', shortCode: 'ICICI', logoColor: '#B45309', contactPerson: 'Sandeep Kulkarni', contactNumber: '+91 22-4008-8900', email: 'dsa.support@icici-partner.test' },
      { id: 'bank_sbi', name: 'State Bank of India', shortCode: 'SBI', logoColor: '#1D4ED8', contactPerson: 'Alok Chatterjee', contactNumber: '+91 22-2274-0800', email: 'retail.tieup@sbi-partner.test' },
      { id: 'bank_axis', name: 'Axis Bank', shortCode: 'AXIS', logoColor: '#881337', contactPerson: 'Pallavi Deshpande', contactNumber: '+91 22-2425-2525', email: 'loan.desk@axis-partner.test' },
      { id: 'bank_kotak', name: 'Kotak Mahindra Bank', shortCode: 'KOTAK', logoColor: '#DC2626', contactPerson: 'Nitin Khanna', contactNumber: '+91 22-6600-6022', email: 'mortgages@kotak-partner.test' },
      { id: 'bank_bajaj', name: 'Bajaj Finserv', shortCode: 'BAJAJ', logoColor: '#0369A1', contactPerson: 'Gaurav Saxena', contactNumber: '+91 20-3957-5152', email: 'b2b.loans@bajaj-partner.test' },
    ];

    for (const bank of banksSeed) {
      ops.push({
        ref: doc(db, 'banks', bank.id),
        data: {
          name: bank.name,
          shortCode: bank.shortCode,
          logoColor: bank.logoColor,
          contactPerson: bank.contactPerson,
          contactNumber: bank.contactNumber,
          email: bank.email,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    }

    // 4. Loan Schemes (12)
    const schemesSeed: Array<{
      id: string;
      bankId: string;
      bankName: string;
      schemeName: string;
      loanType: LoanType;
      minAmount: number;
      maxAmount: number;
      interestRate: number;
      minIncome: number;
      minCreditScore: number;
      processingFee: string;
      tenureMonths: string;
      description: string;
    }> = [
      { id: 'sch_01', bankId: 'bank_hdfc', bankName: 'HDFC Bank', schemeName: 'HDFC Reach Home Advantage', loanType: 'Home Loan', minAmount: 500000, maxAmount: 50000000, interestRate: 8.65, minIncome: 35000, minCreditScore: 720, processingFee: '0.50% + GST', tenureMonths: '60 - 360 months', description: 'Flagship salaried and self-employed residential housing finance.' },
      { id: 'sch_02', bankId: 'bank_hdfc', bankName: 'HDFC Bank', schemeName: 'HDFC Express Personal Loan', loanType: 'Personal Loan', minAmount: 100000, maxAmount: 4000000, interestRate: 10.75, minIncome: 28000, minCreditScore: 730, processingFee: '1.50%', tenureMonths: '12 - 60 months', description: 'Fast-track unsecured personal credit for salaried professionals.' },
      { id: 'sch_03', bankId: 'bank_icici', bankName: 'ICICI Bank', schemeName: 'ICICI Pratham Home Finance', loanType: 'Home Loan', minAmount: 750000, maxAmount: 75000000, interestRate: 8.75, minIncome: 40000, minCreditScore: 725, processingFee: '0.50%', tenureMonths: '60 - 300 months', description: 'Flexible home purchase and balance transfer scheme.' },
      { id: 'sch_04', bankId: 'bank_icici', bankName: 'ICICI Bank', schemeName: 'ICICI Growth MSME Term Loan', loanType: 'Business Loan', minAmount: 300000, maxAmount: 15000000, interestRate: 12.25, minIncome: 65000, minCreditScore: 700, processingFee: '1.25%', tenureMonths: '12 - 60 months', description: 'Working capital and expansion financing for registered SMEs.' },
      { id: 'sch_05', bankId: 'bank_sbi', bankName: 'State Bank of India', schemeName: 'SBI Privilege Home Loan', loanType: 'Home Loan', minAmount: 500000, maxAmount: 60000000, interestRate: 8.45, minIncome: 30000, minCreditScore: 710, processingFee: '0.35% (Max ₹10,000)', tenureMonths: '60 - 360 months', description: 'Low-rate sovereign lender home loan with zero prepayment penalty.' },
      { id: 'sch_06', bankId: 'bank_sbi', bankName: 'State Bank of India', schemeName: 'SBI Scholar Education Plus', loanType: 'Education Loan', minAmount: 200000, maxAmount: 15000000, interestRate: 9.15, minIncome: 25000, minCreditScore: 680, processingFee: 'Nil up to ₹7.5L', tenureMonths: '36 - 180 months', description: 'Domestic and overseas higher education financing.' },
      { id: 'sch_07', bankId: 'bank_axis', bankName: 'Axis Bank', schemeName: 'Axis Drive New Car Loan', loanType: 'Auto Loan', minAmount: 150000, maxAmount: 10000000, interestRate: 9.20, minIncome: 25000, minCreditScore: 700, processingFee: '₹3,500 flat', tenureMonths: '12 - 84 months', description: 'Up to 95% on-road financing for passenger and EV vehicles.' },
      { id: 'sch_08', bankId: 'bank_axis', bankName: 'Axis Bank', schemeName: 'Axis Asset Unlock LAP', loanType: 'Loan Against Property', minAmount: 1000000, maxAmount: 50000000, interestRate: 9.85, minIncome: 60000, minCreditScore: 710, processingFee: '1.00%', tenureMonths: '36 - 180 months', description: 'High-LTV mortgage loan against residential or commercial property.' },
      { id: 'sch_09', bankId: 'bank_kotak', bankName: 'Kotak Mahindra Bank', schemeName: 'Kotak Prime Personal Credit', loanType: 'Personal Loan', minAmount: 100000, maxAmount: 3500000, interestRate: 10.99, minIncome: 30000, minCreditScore: 725, processingFee: '1.75%', tenureMonths: '12 - 60 months', description: 'Digital KYC personal loan with 48-hour sanction SLA.' },
      { id: 'sch_10', bankId: 'bank_kotak', bankName: 'Kotak Mahindra Bank', schemeName: 'Kotak Digi Home Loan', loanType: 'Home Loan', minAmount: 800000, maxAmount: 40000000, interestRate: 8.70, minIncome: 38000, minCreditScore: 730, processingFee: '0.50%', tenureMonths: '60 - 300 months', description: 'Instant sanction-in-principle residential mortgage product.' },
      { id: 'sch_11', bankId: 'bank_bajaj', bankName: 'Bajaj Finserv', schemeName: 'Bajaj Flexi Business Loan', loanType: 'Business Loan', minAmount: 200000, maxAmount: 8000000, interestRate: 13.50, minIncome: 50000, minCreditScore: 695, processingFee: '2.00%', tenureMonths: '12 - 72 months', description: 'Dropline overdraft and flexi-hybrid term loan for traders.' },
      { id: 'sch_12', bankId: 'bank_bajaj', bankName: 'Bajaj Finserv', schemeName: 'Bajaj Insta Personal Hybrid', loanType: 'Personal Loan', minAmount: 75000, maxAmount: 2500000, interestRate: 11.40, minIncome: 22000, minCreditScore: 700, processingFee: '1.50%', tenureMonths: '12 - 60 months', description: 'Quick personal loan with flexible part-payment facility.' },
    ];

    for (const sch of schemesSeed) {
      ops.push({
        ref: doc(db, 'loan_schemes', sch.id),
        data: {
          bankId: sch.bankId,
          bankName: sch.bankName,
          schemeName: sch.schemeName,
          loanType: sch.loanType,
          minAmount: sch.minAmount,
          maxAmount: sch.maxAmount,
          interestRate: sch.interestRate,
          minIncome: sch.minIncome,
          minCreditScore: sch.minCreditScore,
          processingFee: sch.processingFee,
          tenureMonths: sch.tenureMonths,
          description: sch.description,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    }

    // 5. 110 Demo Customer Leads (85 assigned across 20 staff, 25 unassigned)
    const leadsSeed: Array<{
      id: string;
      leadCode: string;
      customerName: string;
      phone: string;
      email: string;
      city: string;
      state: string;
      employmentType: EmploymentType;
      monthlyIncome: number;
      requiredLoanAmount: number;
      loanType: LoanType;
      preferredBank: string;
      leadSource: string;
      assignedEmployeeId?: string;
      assignedEmployeeName?: string;
      assignedEmployeeEmail?: string;
      status: LeadStatus;
      priority: LeadPriority;
      leadDate: string;
    }> = [];

    for (let i = 0; i < 110; i++) {
      const id = `lead_${String(i + 1).padStart(3, '0')}`;
      const leadCode = `LD-${String(1001 + i)}`;
      const fn = FIRST_NAMES[i % FIRST_NAMES.length];
      const ln = LAST_NAMES[(i * 3 + 7) % LAST_NAMES.length];
      const customerName = `${fn} ${ln}`;
      const phone = `+91 98000-${String(10001 + i)}`;
      const email = `demo.lead${String(i + 1).padStart(3, '0')}@example.test`;
      const loc = CITIES[i % CITIES.length];
      const loanType = LOAN_TYPES[i % LOAN_TYPES.length];
      const employmentType = EMPLOYMENT_TYPES[i % EMPLOYMENT_TYPES.length];
      const monthlyIncome = 32000 + ((i * 7500) % 180000);
      const baseLoan =
        loanType === 'Home Loan' ? 3500000 :
        loanType === 'Loan Against Property' ? 4200000 :
        loanType === 'Business Loan' ? 1400000 :
        loanType === 'Auto Loan' ? 950000 :
        loanType === 'Education Loan' ? 1200000 : 450000;
      const requiredLoanAmount = baseLoan + ((i % 6) * 250000);
      const preferredBank = banksSeed[i % banksSeed.length].name;
      const leadSource = LEAD_SOURCES[i % LEAD_SOURCES.length];
      const priority = PRIORITIES[i % PRIORITIES.length];
      const isAssigned = i < 85;
      // Ensure Priya Nair (staff@loancrm.com, index 0) gets 10 leads so Staff demo view is rich
      const empIdx = i < 10 ? 0 : (i - 10) % 19 + 1;
      const emp = isAssigned ? staffRecords[empIdx] : null;
      const status: LeadStatus = !isAssigned
        ? 'New'
        : LEAD_STATUSES[(i % (LEAD_STATUSES.length - 1)) + 1];
      const daysAgo = i < 18 ? 0 : (i % 14);
      const leadDate = daysAgoIso(daysAgo, 9 + (i % 8), (i * 7) % 55);

      leadsSeed.push({
        id,
        leadCode,
        customerName,
        phone,
        email,
        city: loc.city,
        state: loc.state,
        employmentType,
        monthlyIncome,
        requiredLoanAmount,
        loanType,
        preferredBank,
        leadSource,
        assignedEmployeeId: emp?.id,
        assignedEmployeeName: emp?.name,
        assignedEmployeeEmail: emp?.email,
        status,
        priority,
        leadDate,
      });

      const seedScore = computeBaselineLeadScore({
        city: loc.city,
        employmentType,
        monthlyIncome,
        requiredLoanAmount,
        loanType,
        leadSource,
        status,
        priority,
      });

      ops.push({
        ref: doc(db, 'leads', id),
        data: {
          leadCode,
          customerName,
          phone,
          email,
          city: loc.city,
          state: loc.state,
          employmentType,
          monthlyIncome,
          requiredLoanAmount,
          loanType,
          preferredBank,
          leadSource,
          ...(emp
            ? {
                assignedEmployeeId: emp.id,
                assignedEmployeeName: emp.name,
                assignedEmployeeEmail: emp.email,
              }
            : {}),
          status,
          priority,
          remarks: isAssigned
            ? `Demo record: ${loanType} inquiry sourced via ${leadSource}. Initial profile verified.`
            : `Demo record: New ${loanType} inquiry awaiting agent assignment.`,
          leadScore: seedScore.leadScore,
          scoreTier: seedScore.scoreTier,
          scoreSummary: seedScore.scoreSummary,
          scoreFactors: seedScore.scoreFactors,
          scoredAt: leadDate,
          scoreModel: seedScore.scoreModel,
          leadDate,
          isArchived: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    }

    // 6. Lead Assignments (initial batch for first 25 assigned leads)
    for (let i = 0; i < 25; i++) {
      const lead = leadsSeed[i];
      if (!lead.assignedEmployeeId || !lead.assignedEmployeeName || !lead.assignedEmployeeEmail) continue;
      ops.push({
        ref: doc(db, 'lead_assignments', `asg_${String(i + 1).padStart(3, '0')}`),
        data: {
          leadId: lead.id,
          leadCode: lead.leadCode,
          customerName: lead.customerName,
          toEmployeeId: lead.assignedEmployeeId,
          toEmployeeName: lead.assignedEmployeeName,
          toEmployeeEmail: lead.assignedEmployeeEmail,
          assignedByUid: actorUid,
          assignedByName: actorName || 'CRM Admin',
          method: i % 3 === 0 ? 'round_robin' : i % 2 === 0 ? 'bulk' : 'manual',
          notes: 'Initial territory and workload allocation.',
          createdAt: serverTimestamp(),
        },
      });
    }

    // 7. Call Logs (95 calls over the past 7 days, including 30 calls today!)
    for (let i = 0; i < 95; i++) {
      const lead = leadsSeed[i % 85];
      const emp = staffRecords.find((e) => e.id === lead.assignedEmployeeId) || staffRecords[0];
      const daysAgo = i < 30 ? 0 : ((i - 30) % 6) + 1;
      const callTime = daysAgoIso(daysAgo, 9 + (i % 9), (i * 11) % 58);
      const callStatus = CALL_STATUSES[i % CALL_STATUSES.length];
      const durationSeconds =
        callStatus === 'Not Connected' || callStatus === 'No Answer' || callStatus === 'Busy'
          ? 12 + (i % 20)
          : 95 + ((i * 37) % 420);

      ops.push({
        ref: doc(db, 'call_logs', `call_${String(i + 1).padStart(3, '0')}`),
        data: {
          leadId: lead.id,
          leadCode: lead.leadCode,
          customerName: lead.customerName,
          customerPhone: lead.phone,
          employeeId: emp.id,
          employeeEmail: emp.email,
          employeeName: emp.name,
          callTime,
          durationSeconds,
          status: callStatus,
          remarks: `Demo call note: Discussed ${lead.loanType} eligibility and rate options (${callStatus}).`,
          ...(callStatus === 'Callback Requested' ? { nextFollowUpDate: hoursFromNowIso(6 + (i % 24)) } : {}),
          createdAt: serverTimestamp(),
        },
      });
    }

    // 8. Follow-ups (32 records: overdue, today, upcoming, completed)
    for (let i = 0; i < 32; i++) {
      const lead = leadsSeed[i % 85];
      const emp = staffRecords.find((e) => e.id === lead.assignedEmployeeId) || staffRecords[0];
      let scheduledAt: string;
      let status: 'pending' | 'completed' | 'cancelled' = 'pending';
      if (i < 7) {
        // Overdue
        scheduledAt = daysAgoIso(1 + (i % 3), 11 + (i % 5), 0);
      } else if (i < 17) {
        // Due today
        scheduledAt = hoursFromNowIso((i - 10) * 1.5);
      } else if (i < 25) {
        // Upcoming
        scheduledAt = hoursFromNowIso(26 + (i - 17) * 12);
      } else {
        // Completed
        scheduledAt = daysAgoIso(1 + (i % 4), 14, 30);
        status = 'completed';
      }

      ops.push({
        ref: doc(db, 'follow_ups', `fup_${String(i + 1).padStart(3, '0')}`),
        data: {
          leadId: lead.id,
          leadCode: lead.leadCode,
          customerName: lead.customerName,
          customerPhone: lead.phone,
          employeeId: emp.id,
          employeeEmail: emp.email,
          employeeName: emp.name,
          scheduledAt,
          notes: `Follow up on ${lead.loanType} KYC checklist and preferred bank terms.`,
          status,
          ...(status === 'completed'
            ? {
                completedAt: daysAgoIso(0, 11, 15),
                outcomeNotes: 'Customer confirmed document submission readiness.',
              }
            : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    }

    // 9. Customer Documents (30 docs across statuses)
    const docTypes: DocumentType[] = [
      'Aadhaar Card',
      'PAN Card',
      'Bank Statement',
      'Salary Slip',
      'Employment Proof',
      'Address Proof',
    ];
    const docStatuses: DocumentStatus[] = ['Pending', 'Verified', 'Rejected', 'Re-upload Required'];

    for (let i = 0; i < 30; i++) {
      const lead = leadsSeed[i % 60];
      const emp = staffRecords.find((e) => e.id === lead.assignedEmployeeId) || staffRecords[0];
      const docType = docTypes[i % docTypes.length];
      const status = docStatuses[i % docStatuses.length];
      const ext = i % 3 === 0 ? 'pdf' : 'png';

      ops.push({
        ref: doc(db, 'customer_documents', `doc_${String(i + 1).padStart(3, '0')}`),
        data: {
          leadId: lead.id,
          leadCode: lead.leadCode,
          customerName: lead.customerName,
          employeeId: emp.id,
          employeeEmail: emp.email,
          employeeName: emp.name,
          docType,
          fileName: `${lead.leadCode}_${docType.replace(/\s+/g, '_').toLowerCase()}.${ext}`,
          mimeType: ext === 'pdf' ? 'application/pdf' : 'image/png',
          fileSize: 185000 + i * 14200,
          hasFileBlob: false,
          previewSummary: `Demo ${docType} verification record for ${lead.customerName} (${lead.leadCode}).`,
          status,
          ...(status === 'Rejected' || status === 'Re-upload Required'
            ? { rejectionReason: 'Scanned copy border cropped; please upload full clear front-and-back page.' }
            : {}),
          ...(status === 'Verified'
            ? {
                verifiedByUid: actorUid,
                verifiedByName: actorName || 'CRM Admin',
                verifiedAt: daysAgoIso(1, 16, 20),
              }
            : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    }

    // 10. Loan Applications (28 across all 9 statuses) + Status History
    const appStatuses: LoanApplicationStatus[] = [
      'Lead Interested',
      'Documents Pending',
      'Documents Submitted',
      'Under Bank Review',
      'Additional Documents Required',
      'Approved',
      'Rejected',
      'Disbursed',
      'Closed',
    ];

    for (let i = 0; i < 28; i++) {
      const lead = leadsSeed[i % 50];
      const emp = staffRecords.find((e) => e.id === lead.assignedEmployeeId) || staffRecords[0];
      const scheme = schemesSeed[i % schemesSeed.length];
      const status = appStatuses[i % appStatuses.length];
      const appId = `app_${String(i + 1).padStart(3, '0')}`;
      const appCode = `APP-${202601 + i}`;
      const appDate = daysAgoIso((i % 18) + 1, 12, 0);
      const loanAmount = lead.requiredLoanAmount;

      ops.push({
        ref: doc(db, 'loan_applications', appId),
        data: {
          applicationCode: appCode,
          leadId: lead.id,
          leadCode: lead.leadCode,
          customerName: lead.customerName,
          customerPhone: lead.phone,
          employeeId: emp.id,
          employeeEmail: emp.email,
          employeeName: emp.name,
          bankId: scheme.bankId,
          bankName: scheme.bankName,
          schemeId: scheme.id,
          schemeName: scheme.schemeName,
          loanType: scheme.loanType,
          loanAmount,
          applicationDate: appDate,
          status,
          bankReferenceNumber: `BNK-${scheme.bankName.slice(0, 3).toUpperCase()}-${8800 + i}`,
          remarks: `Submitted under ${scheme.schemeName} at ${scheme.interestRate}% p.a.`,
          ...(status === 'Disbursed'
            ? {
                disbursedAmount: Math.round(loanAmount * 0.95),
                disbursedAt: daysAgoIso(i % 5, 17, 0),
              }
            : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });

      ops.push({
        ref: doc(db, 'loan_status_history', `lsh_${String(i + 1).padStart(3, '0')}_1`),
        data: {
          applicationId: appId,
          applicationCode: appCode,
          employeeEmail: emp.email,
          fromStatus: 'Lead Interested',
          toStatus: status,
          remarks: `Application progressed to ${status}.`,
          changedByUid: actorUid,
          changedByName: actorName || 'CRM Admin',
          createdAt: serverTimestamp(),
        },
      });
    }

    // 11. Activity Logs
    const initialActivities = [
      { action: 'Seed Initialized', entityType: 'system', entityId: 'global', summary: 'Initialized FinBridge CRM demo dataset (20 staff, 110 leads, 6 banks, 28 applications).' },
      { action: 'Loan Disbursed', entityType: 'loan_application', entityId: 'app_008', summary: 'HDFC Bank disbursed ₹33.25 L for APP-202608.' },
      { action: 'KYC Verified', entityType: 'customer_document', entityId: 'doc_002', summary: 'PAN Card verified for LD-1002.' },
      { action: 'Bulk Lead Assignment', entityType: 'lead_assignment', entityId: 'asg_001', summary: 'Distributed 25 inbound leads via workload-balanced round-robin.' },
    ];

    initialActivities.forEach((act, idx) => {
      ops.push({
        ref: doc(db, 'activity_logs', `act_${String(idx + 1).padStart(3, '0')}`),
        data: {
          actorUid,
          actorEmail,
          actorName: actorName || 'CRM Admin',
          actorRole: 'admin',
          action: act.action,
          entityType: act.entityType,
          entityId: act.entityId,
          summary: act.summary,
          createdAt: serverTimestamp(),
        },
      });
    });

    // 12. Real-Time Notifications (Admin & Staff)
    const initialNotifs = buildInitialNotifications(actorName);
    initialNotifs.forEach((n) => {
      ops.push({
        ref: doc(db, 'notifications', n.id),
        data: {
          ...n.data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    });

    await commitInChunks(ops);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/global');
  }
}

function buildInitialNotifications(actorName: string) {
  return [
    {
      id: 'ntf_seed_adm_1',
      data: {
        targetRole: 'admin',
        targetEmail: 'admin@loancrm.com',
        category: 'lead_assigned',
        severity: 'info',
        title: '25 inbound leads routed across 20 agents',
        message: 'Workload-balanced round-robin completed for morning borrower batch.',
        entityType: 'lead',
        entityId: 'lead_001',
        leadCode: 'LD-1001',
        read: false,
        actorName: actorName || 'CRM Admin',
      },
    },
    {
      id: 'ntf_seed_adm_2',
      data: {
        targetRole: 'admin',
        targetEmail: 'admin@loancrm.com',
        category: 'lead_attention',
        severity: 'urgent',
        title: '25 unassigned leads awaiting distribution',
        message: 'High-value Home & Business loan inquiries are queued in Lead Distribution.',
        entityType: 'lead',
        entityId: 'lead_086',
        leadCode: 'LD-1086',
        read: false,
        actorName: 'System Watchdog',
      },
    },
    {
      id: 'ntf_seed_adm_3',
      data: {
        targetRole: 'admin',
        targetEmail: 'admin@loancrm.com',
        category: 'doc_update',
        severity: 'warning',
        title: 'Pending KYC verification queue',
        message: 'Customer Aadhaar, PAN, and Bank Statements require underwriting review.',
        entityType: 'customer_document',
        entityId: 'doc_001',
        leadCode: 'LD-1001',
        read: false,
        actorName: 'Priya Nair',
      },
    },
    {
      id: 'ntf_seed_stf_1',
      data: {
        targetRole: 'staff',
        targetEmail: 'staff@loancrm.com',
        category: 'lead_assigned',
        severity: 'info',
        title: 'New high-priority lead assigned: LD-1001',
        message: 'Borrower inquiry assigned to your Retail Loans queue for first outreach.',
        entityType: 'lead',
        entityId: 'lead_001',
        leadCode: 'LD-1001',
        read: false,
        actorName: actorName || 'CRM Admin',
      },
    },
    {
      id: 'ntf_seed_stf_2',
      data: {
        targetRole: 'staff',
        targetEmail: 'staff@loancrm.com',
        category: 'follow_up_upcoming',
        severity: 'warning',
        title: 'Follow-up scheduled for today',
        message: 'Callback due with borrower regarding income documents and rate quote.',
        entityType: 'follow_up',
        entityId: 'fup_001',
        leadCode: 'LD-1001',
        read: false,
        actorName: 'Scheduler',
      },
    },
    {
      id: 'ntf_seed_stf_3',
      data: {
        targetRole: 'staff',
        targetEmail: 'staff@loancrm.com',
        category: 'doc_update',
        severity: 'urgent',
        title: 'KYC Re-upload Required: Salary Slip',
        message: 'Admin requested a clearer 3-month PDF statement for verification.',
        entityType: 'customer_document',
        entityId: 'doc_004',
        leadCode: 'LD-1004',
        read: false,
        actorName: actorName || 'CRM Admin',
      },
    },
  ];
}

export async function seedNotificationsIfMissing(actorName: string): Promise<void> {
  try {
    const markerSnap = await getDoc(doc(db, 'notifications', 'ntf_seed_adm_1'));
    if (markerSnap.exists()) return;
    const ops: BatchOp[] = buildInitialNotifications(actorName).map((n) => ({
      ref: doc(db, 'notifications', n.id),
      data: {
        ...n.data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    }));
    await commitInChunks(ops);
  } catch (err) {
    console.error('Notification backfill skipped:', err);
  }
}

