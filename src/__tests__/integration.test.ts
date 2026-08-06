/**
 * End-to-end integration tests.
 *
 * Each test documents a concrete real-world scenario with known inputs and
 * asserts the exact decision, reason code, and (where deterministic) the
 * intermediate diagnostic values the caller can rely on.
 */
import { compareAddresses, computeTokenSimilarity, levenshteinDistance } from '../index';
import { classifyToken } from '../tokenizer';

// ---------------------------------------------------------------------------
// Exact-match scenarios
// ---------------------------------------------------------------------------

describe('exact match', () => {
	it('identical addresses match', () => {
		const { isMatch, diagnostics } = compareAddresses('12 Elm Street', '12 Elm Street');
		expect(isMatch).toBe(true);
		expect(diagnostics.decision.reasons).toContain('MATCH');
		expect(diagnostics.textSimilarity).toBe(1);
		expect(diagnostics.numeric.matches).toHaveLength(1);
	});

	it('both addresses empty match', () => {
		const { isMatch, diagnostics } = compareAddresses('', '');
		expect(isMatch).toBe(true);
		// no numeric evidence → strict text threshold; textSimilarity = 1 → passes
		expect(diagnostics.textSimilarity).toBe(1);
	});

	it('case differences are ignored', () => {
		expect(compareAddresses('12 ELM STREET', '12 elm street').isMatch).toBe(true);
	});

	it('punctuation differences are ignored', () => {
		// "no.12, Elm Street" and "no 12 Elm Street" tokenise identically
		expect(compareAddresses('no.12, Elm Street', 'no 12 Elm Street').isMatch).toBe(true);
	});

	it('word order in text tokens does not matter', () => {
		// Flat code + house number matched; text tokens elm/street/flat all find exact peers
		expect(compareAddresses('Flat 3A, 12 Elm Street', '12 Elm Street Flat 3A').isMatch).toBe(true);
	});

	it('extra words in the extracted address do not penalise the score', () => {
		// Reference has ['elm','street']; score = 1.0 because only reference tokens are iterated
		const { isMatch, diagnostics } = compareAddresses('12 Elm Street Springfield', '12 Elm Street');
		expect(isMatch).toBe(true);
		expect(diagnostics.textSimilarity).toBe(1);
	});

	it('address consisting only of a house number matches', () => {
		// No text tokens; computeTokenWiseSimilarity([], []) → 1.0
		expect(compareAddresses('12', '12').isMatch).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// OCR typo tolerance
// ---------------------------------------------------------------------------

describe('OCR typo tolerance', () => {
	it('matches a one-character substitution at end of street name', () => {
		// "Streel" vs "Street": 1 substitution (l→t), distance=1, maxLen=6
		// per-token score = 5/6 ≈ 0.833; avg with 'elm'=1 → 0.917 > threshold 0.88
		const { isMatch, diagnostics } = compareAddresses('12 Elm Streel', '12 Elm Street');
		expect(isMatch).toBe(true);
		expect(diagnostics.textSimilarity).toBeCloseTo(0.917, 2);
	});

	it('matches a one-character omission in the street name', () => {
		// "Stret" vs "Street": 1 insertion, distance=1, maxLen=6, score=0.833; avg=0.917
		const { isMatch, diagnostics } = compareAddresses('12 Elm Stret', '12 Elm Street');
		expect(isMatch).toBe(true);
		expect(diagnostics.textSimilarity).toBeCloseTo(0.917, 2);
	});

	it('does not match when a whole word is missing from the extracted address', () => {
		// "12 Elm" vs "12 Elm Street": 'street' best matches 'elm' (dist=5) → score≈0.167
		// avg = (1 + 0.167) / 2 ≈ 0.583 < 0.88 → TEXT_SIMILARITY_BELOW_THRESHOLD
		const { isMatch, diagnostics } = compareAddresses('12 Elm', '12 Elm Street');
		expect(isMatch).toBe(false);
		expect(diagnostics.decision.reasons).toContain('TEXT_SIMILARITY_BELOW_THRESHOLD');
		expect(diagnostics.textSimilarity).toBeCloseTo(0.583, 2);
	});

	it('does not match an abbreviated street name under default config', () => {
		// "St" vs "Street": dist=4, maxLen=6, score=0.333; avg with elm=1 & springfield=1 → 0.778
		// 0.778 < 0.88 → TEXT_SIMILARITY_BELOW_THRESHOLD
		const { isMatch, diagnostics } = compareAddresses('12 Elm St Springfield', '12 Elm Street Springfield');
		expect(isMatch).toBe(false);
		expect(diagnostics.decision.reasons).toContain('TEXT_SIMILARITY_BELOW_THRESHOLD');
		expect(diagnostics.textSimilarity).toBeCloseTo(0.778, 2);
	});
});

// ---------------------------------------------------------------------------
// House number conflicts
// ---------------------------------------------------------------------------

describe('house number conflicts', () => {
	it('does not match when house numbers differ', () => {
		const { isMatch, diagnostics } = compareAddresses('13 Elm Street', '12 Elm Street');
		expect(isMatch).toBe(false);
		expect(diagnostics.decision.reasons).toContain('NUMERIC_CONFLICT');
		expect(diagnostics.numeric.conflicts).toHaveLength(1);
	});

	it('does not match addresses on completely different streets with different numbers', () => {
		const { isMatch, diagnostics } = compareAddresses('15 Oak Road', '12 Elm Street');
		expect(isMatch).toBe(false);
		expect(diagnostics.numeric.conflicts).toHaveLength(1);
	});

	it('does not match when unit number differs', () => {
		// Both have two numbers: 12 (match) and unit 3 vs 5 (conflict)
		const { isMatch, diagnostics } = compareAddresses('12 Elm Street Unit 3', '12 Elm Street Unit 5');
		expect(isMatch).toBe(false);
		expect(diagnostics.decision.reasons).toContain('NUMERIC_CONFLICT');
	});
});

// ---------------------------------------------------------------------------
// Alphanumeric flat / apartment codes
// ---------------------------------------------------------------------------

describe('alphanumeric flat codes', () => {
	it('matches when flat codes are identical', () => {
		expect(compareAddresses('Flat 3A, 12 Elm Street', 'Flat 3A, 12 Elm Street').isMatch).toBe(true);
	});

	it('does not match when flat codes differ', () => {
		// '3a' → canonicalKey 'alphanumeric:3a'; '3b' → 'alphanumeric:3b' — no set match
		// missingInRight=[3a] → TOO_MANY_MISSING_NUMERIC_TOKENS before positional check
		// (ALPHANUMERIC has numericValue=null so is excluded from positional/conflict pass)
		const { isMatch, diagnostics } = compareAddresses('Flat 3A, 12 Elm Street', 'Flat 3B, 12 Elm Street');
		expect(isMatch).toBe(false);
		expect(diagnostics.numeric.missingInRight).toHaveLength(1);
		// No conflict raised because ALPHANUMERIC tokens are excluded from the positional pass
		expect(diagnostics.numeric.conflicts).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Numeric type semantics — ordinal / roman / arabic are distinct
// ---------------------------------------------------------------------------

describe('numeric type distinctness', () => {
	it('ordinal "1st" and arabic "1" are treated as different identifiers', () => {
		// canonicalKey 'ordinal:1' ≠ 'number:1' → positional conflict → NUMERIC_CONFLICT
		const { isMatch, diagnostics } = compareAddresses('1st Elm Street', '1 Elm Street');
		expect(isMatch).toBe(false);
		expect(diagnostics.decision.reasons).toContain('NUMERIC_CONFLICT');
	});

	it('roman numeral "ii" and arabic "2" are treated as different identifiers', () => {
		// canonicalKey 'roman:2' ≠ 'number:2' → conflict
		const { isMatch, diagnostics } = compareAddresses('12 Elm Street Apt ii', '12 Elm Street Apt 2');
		expect(isMatch).toBe(false);
		expect(diagnostics.decision.reasons).toContain('NUMERIC_CONFLICT');
	});

	it('same roman numeral on both sides matches', () => {
		expect(compareAddresses('12 Elm Street Apt ii', '12 Elm Street Apt ii').isMatch).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Single-character roman numeral classification
// — important because street tokens like "c" or "d" are roman, not words
// ---------------------------------------------------------------------------

describe('single-char roman numeral classification', () => {
	const cases: [string, number][] = [
		['i', 1],
		['v', 5],
		['x', 10],
		['l', 50],
		['c', 100],
		['d', 500],
		['m', 1000],
	];

	it.each(cases)('"%s" classifies as ROMAN_NUMERAL with numericValue %i', (token, value) => {
		const result = classifyToken(token, 0);
		expect(result.type).toBe('ROMAN_NUMERAL');
		expect(result.numericValue).toBe(value);
	});

	it('two addresses with a single-char roman numeral match when both have the same one', () => {
		// "d" is ROMAN_NUMERAL(500), not a WORD — treated as a numeric identifier
		expect(compareAddresses('12 Elm Street Apt d', '12 Elm Street Apt d').isMatch).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Text-only addresses (no numeric tokens) use stricter threshold
// ---------------------------------------------------------------------------

describe('text-only addresses (no numeric evidence)', () => {
	it('exact text match passes the stricter threshold', () => {
		expect(compareAddresses('Elm Street', 'Elm Street').isMatch).toBe(true);
	});

	it('high-similarity text scores below 0.95 do not match', () => {
		// 'Stret' vs 'Street': score=0.833; avg with 'elm'=1 → 0.917 < 0.95 (strict threshold)
		const { isMatch, diagnostics } = compareAddresses('Elm Stret', 'Elm Street');
		expect(isMatch).toBe(false);
		expect(diagnostics.decision.reasons).toContain('TEXT_SIMILARITY_BELOW_THRESHOLD');
		expect(diagnostics.textSimilarity).toBeCloseTo(0.917, 2);
	});

	it('uses lenient threshold (0.88) when numeric tokens are present', () => {
		// Same typo as above but with a house number — threshold drops to 0.88, 0.917 passes
		expect(compareAddresses('12 Elm Stret', '12 Elm Street').isMatch).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Config overrides behave correctly
// ---------------------------------------------------------------------------

describe('config overrides', () => {
	it('lowering minTextSimilarity allows abbreviation matches', () => {
		// "St" vs "Street" scores ≈ 0.333 per token; avg ≈ 0.778 → matches with threshold 0.70
		expect(
			compareAddresses('12 Elm St Springfield', '12 Elm Street Springfield', {
				minTextSimilarity: 0.7,
			}).isMatch,
		).toBe(true);
	});

	it('disabling failOnAnyNumericConflict allows mismatched types to proceed', () => {
		// "1st" vs "1" → conflict suppressed; text tokens ('elm','street') score 1.0 → MATCH
		expect(
			compareAddresses('1st Elm Street', '1 Elm Street', {
				failOnAnyNumericConflict: false,
				maxMissingNumericTokens: 1,
				maxExtraNumericTokens: 1,
				requireAtLeastOneNumericMatchWhenNumericPresent: false,
			}).isMatch,
		).toBe(true);
	});

	it('raising maxExtraNumericTokens allows a reference with an extra number', () => {
		expect(
			compareAddresses('12 Elm Street', '12 34 Elm Street', {
				maxExtraNumericTokens: 1,
			}).isMatch,
		).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Deterministic levenshtein values used by the library
// ---------------------------------------------------------------------------

describe('levenshteinDistance — values the library depends on', () => {
	it('"stret" → "street": 1 (one insertion)', () => {
		expect(levenshteinDistance('stret', 'street')).toBe(1);
	});

	it('"streel" → "street": 1 (one substitution)', () => {
		expect(levenshteinDistance('streel', 'street')).toBe(1);
	});

	it('"st" → "street": 4', () => {
		expect(levenshteinDistance('st', 'street')).toBe(4);
	});

	it('"elm" → "street": 5', () => {
		expect(levenshteinDistance('elm', 'street')).toBe(5);
	});
});

describe('computeTokenSimilarity — scores the library depends on', () => {
	it('"stret" / "street" ≈ 0.833', () => {
		expect(computeTokenSimilarity('stret', 'street')).toBeCloseTo(0.833, 2);
	});

	it('"st" / "street" ≈ 0.333', () => {
		expect(computeTokenSimilarity('st', 'street')).toBeCloseTo(0.333, 2);
	});
});
