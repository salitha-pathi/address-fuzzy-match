import { decideAddressMatch } from '../decision';
import type { NumericComparisonResult, AddressMatchConfig } from '../types';

const BASE_CONFIG: AddressMatchConfig = {
	minTextSimilarity: 0.88,
	minTextSimilarityWhenNoNumericEvidence: 0.95,
	maxMissingNumericTokens: 0,
	maxExtraNumericTokens: 0,
	failOnAnyNumericConflict: true,
	requireAtLeastOneNumericMatchWhenNumericPresent: true,
	treatAlphanumericAsNumeric: true,
};

function makeNumeric(overrides: Partial<NumericComparisonResult> = {}): NumericComparisonResult {
	return {
		matches: [],
		missingInRight: [],
		extraInRight: [],
		conflicts: [],
		totalLeft: 0,
		totalRight: 0,
		...overrides,
	};
}

const DUMMY_TOKEN = {
	raw: '12',
	index: 0,
	type: 'NUMBER' as const,
	numericValue: 12,
	canonicalKey: 'number:12',
};

describe('decideAddressMatch', () => {
	it('returns MATCH when all conditions pass with numeric evidence', () => {
		const numeric = makeNumeric({ matches: [DUMMY_TOKEN], totalLeft: 1, totalRight: 1 });
		const result = decideAddressMatch(numeric, 0.95, BASE_CONFIG);
		expect(result.isMatch).toBe(true);
		expect(result.reasons).toContain('MATCH');
	});

	it('returns MATCH when no numeric evidence and text score meets stricter threshold', () => {
		const numeric = makeNumeric();
		const result = decideAddressMatch(numeric, 0.96, BASE_CONFIG);
		expect(result.isMatch).toBe(true);
	});

	it('returns NUMERIC_CONFLICT when a conflict exists and failOnAnyNumericConflict is true', () => {
		const conflict = {
			left: DUMMY_TOKEN,
			right: { ...DUMMY_TOKEN, raw: '15', canonicalKey: 'number:15' },
			reason: 'MISMATCHED_NUMERIC_IDENTIFIER' as const,
		};
		const numeric = makeNumeric({ conflicts: [conflict], totalLeft: 1, totalRight: 1 });
		const result = decideAddressMatch(numeric, 1, BASE_CONFIG);
		expect(result.isMatch).toBe(false);
		expect(result.reasons).toContain('NUMERIC_CONFLICT');
	});

	it('does not fail on conflict when failOnAnyNumericConflict is false', () => {
		const conflict = {
			left: DUMMY_TOKEN,
			right: { ...DUMMY_TOKEN, raw: '15', canonicalKey: 'number:15' },
			reason: 'MISMATCHED_NUMERIC_IDENTIFIER' as const,
		};
		const numeric = makeNumeric({ conflicts: [conflict], matches: [DUMMY_TOKEN], totalLeft: 1, totalRight: 1 });
		const result = decideAddressMatch(numeric, 1, { ...BASE_CONFIG, failOnAnyNumericConflict: false });
		expect(result.reasons).not.toContain('NUMERIC_CONFLICT');
	});

	it('returns TOO_MANY_MISSING_NUMERIC_TOKENS when missing exceeds limit', () => {
		const numeric = makeNumeric({ missingInRight: [DUMMY_TOKEN], totalLeft: 1, totalRight: 0 });
		const result = decideAddressMatch(numeric, 1, BASE_CONFIG);
		expect(result.isMatch).toBe(false);
		expect(result.reasons).toContain('TOO_MANY_MISSING_NUMERIC_TOKENS');
	});

	it('allows missing tokens up to maxMissingNumericTokens', () => {
		const numeric = makeNumeric({ missingInRight: [DUMMY_TOKEN], matches: [DUMMY_TOKEN], totalLeft: 2, totalRight: 1 });
		const result = decideAddressMatch(numeric, 1, { ...BASE_CONFIG, maxMissingNumericTokens: 1 });
		expect(result.reasons).not.toContain('TOO_MANY_MISSING_NUMERIC_TOKENS');
	});

	it('returns TOO_MANY_EXTRA_NUMERIC_TOKENS when extra exceeds limit', () => {
		const numeric = makeNumeric({ extraInRight: [DUMMY_TOKEN], matches: [DUMMY_TOKEN], totalLeft: 1, totalRight: 2 });
		const result = decideAddressMatch(numeric, 1, BASE_CONFIG);
		expect(result.isMatch).toBe(false);
		expect(result.reasons).toContain('TOO_MANY_EXTRA_NUMERIC_TOKENS');
	});

	it('allows extra tokens up to maxExtraNumericTokens', () => {
		const numeric = makeNumeric({ extraInRight: [DUMMY_TOKEN], matches: [DUMMY_TOKEN], totalLeft: 1, totalRight: 2 });
		const result = decideAddressMatch(numeric, 1, { ...BASE_CONFIG, maxExtraNumericTokens: 1 });
		expect(result.reasons).not.toContain('TOO_MANY_EXTRA_NUMERIC_TOKENS');
	});

	it('returns NO_NUMERIC_OVERLAP when numeric is present but no matches', () => {
		const numeric = makeNumeric({
			totalLeft: 1,
			totalRight: 1,
			missingInRight: [DUMMY_TOKEN],
			extraInRight: [{ ...DUMMY_TOKEN, raw: '15' }],
		});
		const result = decideAddressMatch(numeric, 1, {
			...BASE_CONFIG,
			maxMissingNumericTokens: 1,
			maxExtraNumericTokens: 1,
		});
		expect(result.isMatch).toBe(false);
		expect(result.reasons).toContain('NO_NUMERIC_OVERLAP');
	});

	it('skips NO_NUMERIC_OVERLAP check when requireAtLeastOneNumericMatchWhenNumericPresent is false', () => {
		const numeric = makeNumeric({
			totalLeft: 1,
			totalRight: 1,
			missingInRight: [DUMMY_TOKEN],
			extraInRight: [{ ...DUMMY_TOKEN, raw: '15' }],
		});
		const result = decideAddressMatch(numeric, 1, {
			...BASE_CONFIG,
			maxMissingNumericTokens: 1,
			maxExtraNumericTokens: 1,
			requireAtLeastOneNumericMatchWhenNumericPresent: false,
		});
		expect(result.reasons).not.toContain('NO_NUMERIC_OVERLAP');
	});

	it('returns TEXT_SIMILARITY_BELOW_THRESHOLD when text score is too low (with numeric)', () => {
		const numeric = makeNumeric({ matches: [DUMMY_TOKEN], totalLeft: 1, totalRight: 1 });
		const result = decideAddressMatch(numeric, 0.5, BASE_CONFIG);
		expect(result.isMatch).toBe(false);
		expect(result.reasons).toContain('TEXT_SIMILARITY_BELOW_THRESHOLD');
	});

	it('uses stricter threshold when no numeric evidence', () => {
		const numeric = makeNumeric();
		// 0.90 passes minTextSimilarity (0.88) but fails minTextSimilarityWhenNoNumericEvidence (0.95)
		const result = decideAddressMatch(numeric, 0.9, BASE_CONFIG);
		expect(result.isMatch).toBe(false);
		expect(result.reasons).toContain('TEXT_SIMILARITY_BELOW_THRESHOLD');
	});

	it('uses lenient threshold when numeric evidence is present', () => {
		const numeric = makeNumeric({ matches: [DUMMY_TOKEN], totalLeft: 1, totalRight: 1 });
		// 0.90 passes minTextSimilarity (0.88)
		const result = decideAddressMatch(numeric, 0.9, BASE_CONFIG);
		expect(result.isMatch).toBe(true);
	});
});
