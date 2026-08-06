import { extractNumericTokens, compareNumericTokens } from '../numeric';
import type { ClassifiedToken, NumericTokenInfo, AddressMatchConfig } from '../types';

const BASE_CONFIG: AddressMatchConfig = {
	minTextSimilarity: 0.88,
	minTextSimilarityWhenNoNumericEvidence: 0.95,
	maxMissingNumericTokens: 0,
	maxExtraNumericTokens: 0,
	failOnAnyNumericConflict: true,
	requireAtLeastOneNumericMatchWhenNumericPresent: true,
	treatAlphanumericAsNumeric: true,
};

function makeToken(
	raw: string,
	type: ClassifiedToken['type'],
	numericValue: number | null,
	index = 0,
): ClassifiedToken {
	return { raw, index, type, numericValue };
}

function makeNumeric(
	raw: string,
	type: ClassifiedToken['type'],
	numericValue: number | null,
	canonicalKey: string,
	index = 0,
): NumericTokenInfo {
	return { raw, index, type, numericValue, canonicalKey };
}

describe('extractNumericTokens', () => {
	it('returns empty array for empty input', () => {
		expect(extractNumericTokens([], BASE_CONFIG)).toEqual([]);
	});

	it('extracts NUMBER tokens with canonical key', () => {
		const tokens = [makeToken('12', 'NUMBER', 12)];
		const result = extractNumericTokens(tokens, BASE_CONFIG);
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ raw: '12', type: 'NUMBER', canonicalKey: 'number:12' });
	});

	it('extracts ORDINAL tokens with canonical key', () => {
		const tokens = [makeToken('3rd', 'ORDINAL', 3)];
		const result = extractNumericTokens(tokens, BASE_CONFIG);
		expect(result[0]).toMatchObject({ canonicalKey: 'ordinal:3' });
	});

	it('extracts ROMAN_NUMERAL tokens with canonical key', () => {
		const tokens = [makeToken('iv', 'ROMAN_NUMERAL', 4)];
		const result = extractNumericTokens(tokens, BASE_CONFIG);
		expect(result[0]).toMatchObject({ canonicalKey: 'roman:4' });
	});

	it('extracts ALPHANUMERIC tokens when treatAlphanumericAsNumeric is true', () => {
		const tokens = [makeToken('3a', 'ALPHANUMERIC', null)];
		const result = extractNumericTokens(tokens, BASE_CONFIG);
		expect(result[0]).toMatchObject({ canonicalKey: 'alphanumeric:3a' });
	});

	it('skips ALPHANUMERIC tokens when treatAlphanumericAsNumeric is false', () => {
		const tokens = [makeToken('3a', 'ALPHANUMERIC', null)];
		const result = extractNumericTokens(tokens, { ...BASE_CONFIG, treatAlphanumericAsNumeric: false });
		expect(result).toHaveLength(0);
	});

	it('skips WORD tokens', () => {
		const tokens = [makeToken('elm', 'WORD', null), makeToken('12', 'NUMBER', 12)];
		const result = extractNumericTokens(tokens, BASE_CONFIG);
		expect(result).toHaveLength(1);
		expect(result[0].raw).toBe('12');
	});

	it('handles mixed token array', () => {
		const tokens = [
			makeToken('12', 'NUMBER', 12, 0),
			makeToken('elm', 'WORD', null, 1),
			makeToken('3rd', 'ORDINAL', 3, 2),
			makeToken('iv', 'ROMAN_NUMERAL', 4, 3),
			makeToken('3a', 'ALPHANUMERIC', null, 4),
		];
		const result = extractNumericTokens(tokens, BASE_CONFIG);
		expect(result).toHaveLength(4);
	});
});

describe('compareNumericTokens', () => {
	it('returns all-empty result for two empty arrays', () => {
		const result = compareNumericTokens([], []);
		expect(result.matches).toEqual([]);
		expect(result.missingInRight).toEqual([]);
		expect(result.extraInRight).toEqual([]);
		expect(result.conflicts).toEqual([]);
		expect(result.totalLeft).toBe(0);
		expect(result.totalRight).toBe(0);
	});

	it('produces matches when both sides share the same token', () => {
		const token = makeNumeric('12', 'NUMBER', 12, 'number:12');
		const result = compareNumericTokens([token], [token]);
		expect(result.matches).toHaveLength(1);
		expect(result.missingInRight).toHaveLength(0);
		expect(result.extraInRight).toHaveLength(0);
	});

	it('reports missingInRight when left has a token absent from right', () => {
		const left = makeNumeric('12', 'NUMBER', 12, 'number:12');
		const result = compareNumericTokens([left], []);
		expect(result.missingInRight).toHaveLength(1);
		expect(result.missingInRight[0].raw).toBe('12');
		expect(result.matches).toHaveLength(0);
	});

	it('reports extraInRight when right has a token absent from left', () => {
		const right = makeNumeric('15', 'NUMBER', 15, 'number:15');
		const result = compareNumericTokens([], [right]);
		expect(result.extraInRight).toHaveLength(1);
		expect(result.extraInRight[0].raw).toBe('15');
	});

	it('reports a conflict when tokens at the same position differ', () => {
		const left = makeNumeric('12', 'NUMBER', 12, 'number:12');
		const right = makeNumeric('15', 'NUMBER', 15, 'number:15');
		const result = compareNumericTokens([left], [right]);
		expect(result.conflicts).toHaveLength(1);
		expect(result.conflicts[0].reason).toBe('MISMATCHED_NUMERIC_IDENTIFIER');
		expect(result.conflicts[0].left.raw).toBe('12');
		expect(result.conflicts[0].right.raw).toBe('15');
	});

	it('handles duplicate canonical keys via bucket counting', () => {
		const t = makeNumeric('12', 'NUMBER', 12, 'number:12');
		const result = compareNumericTokens([t, t], [t]);
		expect(result.matches).toHaveLength(1);
		expect(result.missingInRight).toHaveLength(1);
	});

	it('skips ALPHANUMERIC tokens from the positional conflict check (null numericValue)', () => {
		const left = makeNumeric('3a', 'ALPHANUMERIC', null, 'alphanumeric:3a');
		const right = makeNumeric('3b', 'ALPHANUMERIC', null, 'alphanumeric:3b');
		const result = compareNumericTokens([left], [right]);
		// No positional conflict because numericValue is null — excluded from comparable arrays
		expect(result.conflicts).toHaveLength(0);
	});

	it('reports correct totalLeft and totalRight counts', () => {
		const a = makeNumeric('12', 'NUMBER', 12, 'number:12');
		const b = makeNumeric('15', 'NUMBER', 15, 'number:15');
		const result = compareNumericTokens([a, b], [a]);
		expect(result.totalLeft).toBe(2);
		expect(result.totalRight).toBe(1);
	});

	it('does not produce a conflict when tokens at the same position match', () => {
		const t = makeNumeric('12', 'NUMBER', 12, 'number:12');
		const result = compareNumericTokens([t], [t]);
		expect(result.conflicts).toHaveLength(0);
	});
});
