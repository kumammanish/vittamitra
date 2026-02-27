import { useState, useCallback } from 'react'

// ── Global app state shared across tabs ──────────────────────────────────────
export interface AppState {
    summary: any | null
    comparison: any | null
    deductions: any | null
    healthScore: any | null
    grossIncome: number
    tds: number
    claimed80C: number
    claimed80D: number
    claimedHRA: number
    claimedHomeLoan: number
    claimedNPS: number
    age: number
    hasParents: boolean
    parentsSenior: boolean
    isMetro: boolean
    apiKey: string
    llmModel: string
    llmBaseUrl: string
    // ── Tax Filing ────────────────────────────────────────────────────────────
    form16Result: any | null
    fdInterest: number
    savingsInterest: number
    otherInterest: number
    dividendIncome: number
    annualRentReceived: number
    municipalTaxesPaid: number
    rentalHomeLoanInterest: number
    isSelfOccupied: boolean
    capitalGainsResult: any | null
    residentialStatus: 'Resident' | 'RNOR' | 'NRI'
    dtaaCountry: string
    nriProfile: any | null
    otherIncomeResult: any | null
    itrSummary: any | null
}

const DEFAULT_STATE: AppState = {
    summary: null,
    comparison: null,
    deductions: null,
    healthScore: null,
    grossIncome: 0,
    tds: 0,
    claimed80C: 0,
    claimed80D: 0,
    claimedHRA: 0,
    claimedHomeLoan: 0,
    claimedNPS: 0,
    age: 30,
    hasParents: false,
    parentsSenior: false,
    isMetro: true,
    apiKey: '',
    llmModel: 'gpt-4o-mini',
    llmBaseUrl: '',
    form16Result: null,
    fdInterest: 0,
    savingsInterest: 0,
    otherInterest: 0,
    dividendIncome: 0,
    annualRentReceived: 0,
    municipalTaxesPaid: 0,
    rentalHomeLoanInterest: 0,
    isSelfOccupied: false,
    capitalGainsResult: null,
    residentialStatus: 'Resident',
    dtaaCountry: '',
    nriProfile: null,
    otherIncomeResult: null,
    itrSummary: null,
}

export function useAppState() {
    const [state, setState] = useState<AppState>(DEFAULT_STATE)

    const update = useCallback((partial: Partial<AppState>) => {
        setState(prev => ({ ...prev, ...partial }))
    }, [])

    return { state, update }
}

export function fmt(n: number) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', maximumFractionDigits: 0
    }).format(n)
}

export function fmtK(n: number) {
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
    if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`
    return `₹${n.toFixed(0)}`
}
