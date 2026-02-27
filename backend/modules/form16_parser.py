"""
Module F: Form 16 / 16A / 16B Parser
Parses TDS certificate PDFs and Excel files for salaried employees.
Uses pdfplumber for PDF text extraction and openpyxl/pandas for Excel.
Regex-based field detection covers standard TRACES-generated Form 16 layouts.
"""
import re
import json
from pathlib import Path
from typing import Optional

import pdfplumber
import pandas as pd

CONFIG_PATH = Path(__file__).parent.parent / "config" / "tax_rules.json"

# Regex patterns for labeled fields in Form 16 text
# Each key maps to a list of patterns to try in order
FIELD_PATTERNS = {
    "gross_salary": [
        r"gross\s+salary[^\d]*?([\d,]+)",
        r"total\s+salary[^\d]*?([\d,]+)",
        r"(?:a)\s*salary[^\d]*?([\d,]+)",
    ],
    "standard_deduction": [
        r"standard\s+deduction[^\d]*?([\d,]+)",
        r"std\.?\s+deduction[^\d]*?([\d,]+)",
    ],
    "professional_tax": [
        r"professional\s+tax[^\d]*?([\d,]+)",
        r"pt\s+deduction[^\d]*?([\d,]+)",
    ],
    "tds_deducted": [
        r"tax\s+deducted\s+at\s+source[^\d]*?([\d,]+)",
        r"tds\s+deducted[^\d]*?([\d,]+)",
        r"total\s+tax\s+deducted[^\d]*?([\d,]+)",
        r"amount\s+of\s+tax\s+deducted[^\d]*?([\d,]+)",
    ],
    "tds_deposited": [
        r"tax\s+deposited[^\d]*?([\d,]+)",
        r"amount\s+deposited[^\d]*?([\d,]+)",
        r"tds\s+deposited[^\d]*?([\d,]+)",
    ],
    "net_taxable_salary": [
        r"net\s+taxable\s+salary[^\d]*?([\d,]+)",
        r"taxable\s+salary[^\d]*?([\d,]+)",
        r"income\s+chargeable\s+under\s+the\s+head\s+salaries[^\d]*?([\d,]+)",
    ],
    "hra_exemption": [
        r"house\s+rent\s+allowance[^\d]*?([\d,]+)",
        r"hra\s+exemption[^\d]*?([\d,]+)",
        r"exemption\s+u/s\s+10\(13a\)[^\d]*?([\d,]+)",
    ],
    "chapter_via_deductions": [
        r"chapter\s+vi[-–]a\s+deductions[^\d]*?([\d,]+)",
        r"total\s+deductions[^\d]*?([\d,]+)",
        r"aggregate\s+of\s+deductions[^\d]*?([\d,]+)",
    ],
    "80c_deduction": [
        r"80c[^\d]*?([\d,]+)",
        r"section\s+80c[^\d]*?([\d,]+)",
    ],
    "80d_deduction": [
        r"80d[^\d]*?([\d,]+)",
        r"section\s+80d[^\d]*?([\d,]+)",
    ],
    "tax_on_total_income": [
        r"tax\s+on\s+total\s+income[^\d]*?([\d,]+)",
        r"income\s+tax\s+thereon[^\d]*?([\d,]+)",
    ],
    "surcharge": [
        r"surcharge[^\d]*?([\d,]+)",
    ],
    "health_education_cess": [
        r"health\s+and\s+education\s+cess[^\d]*?([\d,]+)",
        r"education\s+cess[^\d]*?([\d,]+)",
        r"cess[^\d]*?([\d,]+)",
    ],
    "relief_89": [
        r"relief\s+u/s\s+89[^\d]*?([\d,]+)",
        r"section\s+89[^\d]*?([\d,]+)",
    ],
    "total_income": [
        r"total\s+income[^\d]*?([\d,]+)",
        r"gross\s+total\s+income[^\d]*?([\d,]+)",
    ],
}


def _load_config() -> dict:
    with open(CONFIG_PATH) as f:
        return json.load(f)


def _clean_amount(raw: str) -> float:
    """Remove commas and convert to float."""
    return float(raw.replace(",", "").strip())


def _extract_amount(text: str, label_patterns: list) -> Optional[float]:
    """
    Find the first numeric value appearing after any of the given label patterns.
    Patterns are tried in order; first match wins.
    """
    text_lower = text.lower()
    for pattern in label_patterns:
        match = re.search(pattern, text_lower, re.IGNORECASE)
        if match:
            try:
                return _clean_amount(match.group(1))
            except (ValueError, IndexError):
                continue
    return None


def _extract_pan(text: str) -> Optional[str]:
    """Extract PAN using standard 10-char regex."""
    match = re.search(r"\b([A-Z]{5}[0-9]{4}[A-Z])\b", text)
    return match.group(1) if match else None


def _extract_tan(text: str) -> Optional[str]:
    """Extract TAN using standard 10-char regex."""
    match = re.search(r"\b([A-Z]{4}[0-9]{5}[A-Z])\b", text)
    return match.group(1) if match else None


def _extract_employer_name(text: str) -> Optional[str]:
    """Try to extract employer name from common Form 16 header patterns."""
    patterns = [
        r"name\s+of\s+employer[:\s]+([A-Za-z0-9\s&.,()-]+?)(?:\n|tan|pan|address)",
        r"employer[:\s]+([A-Za-z0-9\s&.,()-]+?)(?:\n|tan|pan)",
        r"name\s+of\s+the\s+employer[:\s]+([^\n]+)",
    ]
    text_lower = text.lower()
    for pattern in patterns:
        match = re.search(pattern, text_lower, re.IGNORECASE)
        if match:
            return match.group(1).strip().title()
    return None


def _extract_employee_name(text: str) -> Optional[str]:
    """Try to extract employee name from Form 16."""
    patterns = [
        r"name\s+of\s+employee[:\s]+([A-Za-z\s]+?)(?:\n|pan|designation)",
        r"employee[:\s]+([A-Za-z\s]+?)(?:\n|pan)",
        r"name\s+of\s+the\s+employee[:\s]+([^\n]+)",
    ]
    text_lower = text.lower()
    for pattern in patterns:
        match = re.search(pattern, text_lower, re.IGNORECASE)
        if match:
            return match.group(1).strip().title()
    return None


def _extract_assessment_year(text: str) -> Optional[str]:
    """Extract assessment year like 2025-26."""
    match = re.search(r"assessment\s+year[:\s]*(20\d{2}[-–]2?\d{1,2})", text, re.IGNORECASE)
    if match:
        return match.group(1)
    # Also look for AY pattern
    match = re.search(r"\bA\.?Y\.?\s*(20\d{2}[-–]2?\d{1,2})\b", text, re.IGNORECASE)
    return match.group(1) if match else "2025-26"


def _parse_confidence(result: dict) -> str:
    """
    Return 'high' if both gross_salary and tds_deducted are found,
    'medium' if only one is found, 'low' otherwise.
    """
    has_salary = result.get("gross_salary") is not None
    has_tds = result.get("tds_deducted") is not None
    if has_salary and has_tds:
        return "high"
    if has_salary or has_tds:
        return "medium"
    return "low"


def _build_result_from_text(raw_text: str) -> dict:
    """Extract all fields from extracted text and return structured dict."""
    if not raw_text or not raw_text.strip():
        return {
            "employer_name": None,
            "employer_tan": None,
            "employee_name": None,
            "employee_pan": None,
            "assessment_year": "2025-26",
            "gross_salary": None,
            "standard_deduction": None,
            "professional_tax": None,
            "tds_deducted": None,
            "tds_deposited": None,
            "net_taxable_salary": None,
            "allowances": {},
            "deductions_claimed": {},
            "total_income": None,
            "tax_on_total_income": None,
            "surcharge": None,
            "health_education_cess": None,
            "relief_89": None,
            "parse_confidence": "low",
            "notes": ["Scanned PDF detected — pdfplumber could not extract text. Please enter values manually."],
            "raw_text": "",
        }

    result = {}
    for field, patterns in FIELD_PATTERNS.items():
        result[field] = _extract_amount(raw_text, patterns)

    # Named fields
    result["employer_name"] = _extract_employer_name(raw_text)
    result["employer_tan"]  = _extract_tan(raw_text)
    result["employee_name"] = _extract_employee_name(raw_text)
    result["employee_pan"]  = _extract_pan(raw_text)
    result["assessment_year"] = _extract_assessment_year(raw_text)

    # Group allowances
    result["allowances"] = {}
    if result.get("hra_exemption"):
        result["allowances"]["HRA"] = result.pop("hra_exemption")
    else:
        result.pop("hra_exemption", None)

    # Group deductions
    result["deductions_claimed"] = {}
    if result.get("80c_deduction"):
        result["deductions_claimed"]["80C"] = result.pop("80c_deduction")
    else:
        result.pop("80c_deduction", None)
    if result.get("80d_deduction"):
        result["deductions_claimed"]["80D"] = result.pop("80d_deduction")
    else:
        result.pop("80d_deduction", None)
    if result.get("chapter_via_deductions"):
        result["deductions_claimed"]["chapter_vi_total"] = result.pop("chapter_via_deductions")
    else:
        result.pop("chapter_via_deductions", None)

    result["parse_confidence"] = _parse_confidence(result)
    result["notes"] = []
    if result["parse_confidence"] == "low":
        result["notes"].append("Could not parse key fields. Try uploading a text-based (non-scanned) PDF or Excel export.")
    elif result["parse_confidence"] == "medium":
        result["notes"].append("Partial parse. Verify the extracted values before using.")

    result["raw_text"] = raw_text[:2000]  # Keep first 2000 chars for debugging
    return result


def parse_form16_pdf(file_path: str) -> dict:
    """
    Parse a Form 16 PDF using pdfplumber.
    Extracts all text pages, concatenates, then applies regex field detection.
    Returns a normalized dict.
    """
    try:
        with pdfplumber.open(file_path) as pdf:
            pages_text = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages_text.append(text)
            raw_text = "\n".join(pages_text)
    except Exception as e:
        return {
            "parse_confidence": "low",
            "notes": [f"PDF parsing error: {str(e)}"],
            "raw_text": "",
        }

    return _build_result_from_text(raw_text)


def parse_form16_excel(file_path: str) -> dict:
    """
    Parse a Form 16 exported as Excel.
    Reads all sheets, scans every row for label+value pattern.
    Returns same dict structure as parse_form16_pdf.
    """
    try:
        xl = pd.ExcelFile(file_path)
        all_text_parts = []
        for sheet_name in xl.sheet_names:
            df = pd.read_excel(xl, sheet_name=sheet_name, header=None, dtype=str)
            df = df.fillna("")
            # Convert each row to "label: value" style text for regex matching
            for _, row in df.iterrows():
                cells = [str(c).strip() for c in row if str(c).strip()]
                if cells:
                    all_text_parts.append("  ".join(cells))
        raw_text = "\n".join(all_text_parts)
    except Exception as e:
        return {
            "parse_confidence": "low",
            "notes": [f"Excel parsing error: {str(e)}"],
            "raw_text": "",
        }

    return _build_result_from_text(raw_text)


def parse_form16(file_path: str) -> dict:
    """
    Public entry point. Auto-detects format (PDF vs Excel) and dispatches.

    Parameters
    ----------
    file_path : str — absolute path to the Form 16 file

    Returns
    -------
    dict with parsed fields, parse_confidence, and notes
    """
    ext = Path(file_path).suffix.lower()
    if ext == ".pdf":
        return parse_form16_pdf(file_path)
    elif ext in [".xlsx", ".xls"]:
        return parse_form16_excel(file_path)
    else:
        raise ValueError(f"Unsupported Form 16 format: {ext}. Accepted: PDF, XLSX, XLS")
