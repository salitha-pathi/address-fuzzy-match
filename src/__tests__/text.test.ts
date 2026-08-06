import { extractTextTokens, computeTokenWiseSimilarity, computeTokenSimilarity, levenshteinDistance } from '../text';
import type { ClassifiedToken, AddressMatchConfig } from '../types';

const BASE_CONFIG: AddressMatchConfig = {
	minTextSimilarity: 0.88,
	minTextSimilarityWhenNoNumericEvidence: 0.95,
	maxMissingNumericTokens: 0,
	maxExtraNumericTokens: 0,
	failOnAnyNumericConflict: true,
	requireAtLeastOneNumericMatchWhenNumericPresent: true,
	treatAlphanumericAsNumeric: true,
};

function makeToken(raw: string, type: ClassifiedToken['type'], index = 0): ClassifiedToken {
	return { raw, index, type, numericValue: null };
}

describe('extractTextTokens', () => {
	it('returns empty array for empty input', () => {
		expect(extractTextTokens([], BASE_CONFIG)).toEqual([]);
	});

	it('includes WORD tokens', () => {
		const tokens = [makeToken('elm', 'WORD'), makeToken('street', 'WORD', 1)];
		expect(extractTextTokens(tokens, BASE_CONFIG)).toEqual(['elm', 'street']);
	});

	it('excludes NUMBER tokens', () => {
		const tokens = [makeToken('12', 'NUMBER'), makeToken('elm', 'WORD', 1)];
		expect(extractTextTokens(tokens, BASE_CONFIG)).toEqual(['elm']);
	});

	it('excludes ORDINAL tokens', () => {
		const tokens = [makeToken('3rd', 'ORDINAL'), makeToken('elm', 'WORD', 1)];
		expect(extractTextTokens(tokens, BASE_CONFIG)).toEqual(['elm']);
	});

	it('excludes ROMAN_NUMERAL tokens', () => {
		const tokens = [makeToken('iv', 'ROMAN_NUMERAL'), makeToken('elm', 'WORD', 1)];
		expect(extractTextTokens(tokens, BASE_CONFIG)).toEqual(['elm']);
	});

	it('excludes ALPHANUMERIC tokens when treatAlphanumericAsNumeric is true', () => {
		const tokens = [makeToken('3a', 'ALPHANUMERIC'), makeToken('elm', 'WORD', 1)];
		expect(extractTextTokens(tokens, BASE_CONFIG)).toEqual(['elm']);
	});

	it('includes ALPHANUMERIC tokens when treatAlphanumericAsNumeric is false', () => {
		const tokens = [makeToken('3a', 'ALPHANUMERIC'), makeToken('elm', 'WORD', 1)];
		const result = extractTextTokens(tokens, { ...BASE_CONFIG, treatAlphanumericAsNumeric: false });
		expect(result).toEqual(['3a', 'elm']);
	});
});

describe('levenshteinDistance', () => {
	it('returns 0 for identical strings', () => {
		expect(levenshteinDistance('abc', 'abc')).toBe(0);
		expect(levenshteinDistance('', '')).toBe(0);
	});

	it('returns b.length when a is empty', () => {
		expect(levenshteinDistance('', 'abc')).toBe(3);
	});

	it('returns a.length when b is empty', () => {
		expect(levenshteinDistance('abc', '')).toBe(3);
	});

	it('counts a single substitution', () => {
		expect(levenshteinDistance('abc', 'abd')).toBe(1);
	});

	it('counts a single insertion', () => {
		expect(levenshteinDistance('ab', 'abc')).toBe(1);
	});

	it('counts a single deletion', () => {
		expect(levenshteinDistance('abc', 'ab')).toBe(1);
	});

	it('computes the classic kitten→sitting distance', () => {
		expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
	});

	it('handles transpositions correctly', () => {
		expect(levenshteinDistance('ab', 'ba')).toBe(2);
	});
});

describe('computeTokenSimilarity', () => {
	it('returns 1 for identical tokens', () => {
		expect(computeTokenSimilarity('elm', 'elm')).toBe(1);
	});

	it('returns 1 for two empty strings', () => {
		expect(computeTokenSimilarity('', '')).toBe(1);
	});

	it('returns a value between 0 and 1 for similar tokens', () => {
		const score = computeTokenSimilarity('stret', 'street');
		expect(score).toBeGreaterThan(0);
		expect(score).toBeLessThan(1);
	});

	it('returns a lower score for more different tokens', () => {
		const similar = computeTokenSimilarity('stret', 'street');
		const different = computeTokenSimilarity('xyz', 'street');
		expect(similar).toBeGreaterThan(different);
	});

	it('never returns below 0', () => {
		expect(computeTokenSimilarity('aaaa', 'zzzz')).toBeGreaterThanOrEqual(0);
	});
});

describe('computeTokenWiseSimilarity', () => {
	it('returns perfect score when reference is empty', () => {
		const result = computeTokenWiseSimilarity(['elm', 'street'], []);
		expect(result.normalizedScore).toBe(1);
		expect(result.totalScore).toBe(1);
		expect(result.matches).toEqual([]);
	});

	it('returns zero score when extracted is empty and reference is not', () => {
		const result = computeTokenWiseSimilarity([], ['elm', 'street']);
		expect(result.normalizedScore).toBe(0);
		expect(result.totalScore).toBe(0);
		result.matches.forEach((m) => expect(m.bestExtractedToken).toBeNull());
	});

	it('returns score 1 for perfectly matching token arrays', () => {
		const result = computeTokenWiseSimilarity(['elm', 'street'], ['elm', 'street']);
		expect(result.normalizedScore).toBe(1);
	});

	it('scores partial matches between 0 and 1', () => {
		const result = computeTokenWiseSimilarity(['elm', 'stret'], ['elm', 'street']);
		expect(result.normalizedScore).toBeGreaterThan(0);
		expect(result.normalizedScore).toBeLessThan(1);
	});

	it('finds the best extracted token for each reference token', () => {
		const result = computeTokenWiseSimilarity(['elm', 'ave'], ['elm', 'avenue']);
		const elmMatch = result.matches.find((m) => m.referenceToken === 'elm');
		expect(elmMatch?.bestExtractedToken).toBe('elm');
		expect(elmMatch?.score).toBe(1);
	});

	it('normalizedScore equals totalScore divided by reference token count', () => {
		const result = computeTokenWiseSimilarity(['elm', 'st'], ['elm', 'street', 'north']);
		expect(result.normalizedScore).toBeCloseTo(result.totalScore / 3, 10);
	});
});
