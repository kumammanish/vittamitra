import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export interface Transaction {
    date: string
    description: string
    debit: number
    credit: number
    balance: number
    category: string
}

export interface IngestResponse {
    rows: number
    transactions: Transaction[]
    summary: Record<string, number>
}

export interface TaxResult {
    regime: string
    gross_income: number
    standard_deduction: number
    income_after_std_deduction: number
    chapter_vi_deductions: number
    taxable_income: number
    base_tax: number
    tax_after_rebate_87a: number
    surcharge: number
    cess: number
    total_tax: number
    tds_paid: number
    net_payable: number
    refund: number
    deduction_breakdown: Record<string, { claimed: number; allowed: number }>
}

export interface CompareResult {
    old: TaxResult
    new: TaxResult
    saving_if_old: number
    recommended: 'old' | 'new' | 'equal'
    recommendation_note: string
}

export interface Opportunity {
    section: string
    title: string
    description: string
    saving_estimate: number
    risk_level: 'Low' | 'Medium' | 'High'
}

export interface DeductionResult {
    analysis: Record<string, { label: string; limit: number; claimed: number; remaining: number; utilized_pct: number }>
    opportunities: Opportunity[]
    total_potential_saving: number
}

export interface ChatResponse {
    response: string
    source: string
}

export interface HealthScore {
    score: number
    grade: string
    breakdown: Record<string, number>
    avg_monthly_savings_rate: number
    investment_ratio: number
}

// ── Tax Filing Interfaces ─────────────────────────────────────────────────────
export interface Form16Result {
    employer_name: string | null
    employer_tan: string | null
    employee_name: string | null
    employee_pan: string | null
    assessment_year: string
    gross_salary: number | null
    standard_deduction: number | null
    professional_tax: number | null
    tds_deducted: number | null
    tds_deposited: number | null
    net_taxable_salary: number | null
    allowances: Record<string, number>
    deductions_claimed: Record<string, number>
    total_income: number | null
    tax_on_total_income: number | null
    surcharge: number | null
    health_education_cess: number | null
    parse_confidence: 'high' | 'medium' | 'low'
    notes: string[]
}

export interface CapitalGainEntry {
    asset_type: 'listed_equity' | 'equity_mf' | 'debt_mf' | 'property' | 'crypto_vda'
    purchase_price: number
    sale_price: number
    purchase_date: string
    sale_date: string
    cost_of_improvement?: number
    property_acquired_pre_jul23?: boolean
    description?: string
}

export interface CapitalGainEntryResult extends CapitalGainEntry {
    months_held: number
    gain_type: 'stcg' | 'ltcg' | 'special'
    gross_gain: number
    exemption_applied: number
    taxable_gain: number
    tax_rate: number
    tax_amount: number
    tds_applicable: number
    is_loss: boolean
    notes: string[]
}

export interface CapitalGainsResult {
    entries: CapitalGainEntryResult[]
    summary: {
        total_stcg_equity: number
        total_ltcg_equity: number
        ltcg_exemption_used: number
        ltcg_exemption_remaining: number
        total_stcg_debt_property: number
        total_crypto_gain: number
        total_tax_stcg_equity: number
        total_tax_ltcg: number
        total_tax_slab_rate: number
        total_tax_crypto: number
        total_capital_gains_tax: number
        cess: number
        total_with_cess: number
    }
    schedule_cg_notes: string[]
    loss_entries: CapitalGainEntryResult[]
    carry_forward_eligible: boolean
}

export interface InterestIncomeResult {
    fd_interest: number
    savings_interest: number
    other_interest: number
    gross_interest: number
    deduction_80tta: number
    deduction_80ttb: number
    taxable_interest: number
    estimated_tds_on_fd: number
    nre_exempt: boolean
    dtaa_rate: number | null
    notes: string[]
}

export interface RentalIncomeResult {
    gross_annual_value: number
    municipal_taxes_paid: number
    net_annual_value: number
    sec24a_standard_deduction: number
    sec24b_interest_deduction: number
    sec24b_limit_applied: number
    net_income_from_hp: number
    is_loss: boolean
    set_off_against_salary: number
    notes: string[]
}

export interface NRIProfile {
    residential_status: string
    is_nri: boolean
    is_rnor: boolean
    rebate_87a_eligible: boolean
    basic_exemption_limit: number
    nre_interest_exempt: boolean
    dtaa_applicable: boolean
    dtaa_country: string | null
    dtaa_fd_rate: number | null
    dtaa_dividend_rate: number | null
    nri_notes: string[]
}

export interface ITRSummarySchedule {
    assessment_year: string
    filing_type: string
    residential_status: string
    regime: string
    schedule_salary: Record<string, number>
    schedule_hp: Record<string, number>
    schedule_cg: Record<string, number>
    schedule_os: Record<string, number>
    schedule_vi_a: Record<string, number>
    part_b_tti: Record<string, number>
    tds_schedule: Record<string, number>
}

export const apiClient = {
    ingest: (formData: FormData) =>
        api.post<IngestResponse>('/ingest', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),


    getSummary: () => api.get<Record<string, number>>('/summary'),

    getTransactions: () => api.get<Transaction[]>('/transactions'),

    computeTax: (params: { gross_income: number; regime: string; deductions: Record<string, number>; tds_paid: number }) =>
        api.post<TaxResult>('/tax/compute', params),

    compareRegimes: (params: { gross_income: number; deductions: Record<string, number>; tds_paid: number }) =>
        api.post<CompareResult>('/tax/compare', params),

    analyzeDeductions: (params: {
        gross_income: number; claimed: Record<string, number>; tds_paid: number;
        age: number; has_parents: boolean; parents_senior: boolean; is_metro: boolean
    }) => api.post<DeductionResult>('/deductions/analyze', params),

    getMonthlyExpenses: () => api.get<any[]>('/expenses/monthly'),

    getCategoryBreakdown: () => api.get<any[]>('/expenses/categories'),

    getHealthScore: () => api.get<HealthScore>('/expenses/health'),

    getLifestyleInflation: () => api.get<any>('/expenses/lifestyle-inflation'),

    getInvestmentGap: () => api.get<any>('/expenses/investment-gap'),

    chat: (params: { message: string; context?: Record<string, any>; api_key?: string; model?: string; base_url?: string }) =>
        api.post<ChatResponse>('/chat', params),

    // ── Tax Filing ──────────────────────────────────────────────────────────
    parseForm16: (formData: FormData) =>
        api.post<Form16Result>('/filing/form16/parse', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),
    getForm16: () => api.get<Form16Result>('/filing/form16'),

    computeCapitalGains: (params: { entries: CapitalGainEntry[]; slab_rate: number }) =>
        api.post<CapitalGainsResult>('/filing/capital-gains/compute', params),
    getCapitalGains: () => api.get<CapitalGainsResult>('/filing/capital-gains'),

    computeInterestIncome: (params: {
        fd_interest: number; savings_interest: number; other_interest: number
        age: number; residential_status: string; regime: string; dtaa_country?: string
    }) => api.post<InterestIncomeResult>('/filing/income/interest', params),

    computeDividendIncome: (params: {
        dividend_amount: number; age: number; residential_status: string; dtaa_country?: string
    }) => api.post<any>('/filing/income/dividend', params),

    computeRentalIncome: (params: {
        annual_rent_received: number; municipal_taxes_paid: number
        home_loan_interest: number; is_self_occupied: boolean; pre_construction_interest?: number
    }) => api.post<RentalIncomeResult>('/filing/income/rental', params),

    setNRIProfile: (params: {
        residential_status: string; dtaa_country?: string
        fd_interest_nro?: number; fd_interest_nre?: number; dividend?: number; gross_income?: number
    }) => api.post<NRIProfile>('/filing/nri-profile', params),
    getNRIProfile: () => api.get<NRIProfile>('/filing/nri-profile'),

    generateITRSummary: (params: { regime: string; include_capital_gains: boolean; include_other_income: boolean }) =>
        api.post<ITRSummarySchedule>('/filing/itr-summary', params),
    getITRSummary: () => api.get<ITRSummarySchedule>('/filing/itr-summary'),
}
