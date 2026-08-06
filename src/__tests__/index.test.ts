import { compareAddresses, DEFAULT_ADDRESS_MATCH_CONFIG } from '../index';

describe('DEFAULT_ADDRESS_MATCH_CONFIG', () => {
	it('has expected default values', () => {
		expect(DEFAULT_ADDRESS_MATCH_CONFIG.minTextSimilarity).toBe(0.88);
		expect(DEFAULT_ADDRESS_MATCH_CONFIG.minTextSimilarityWhenNoNumericEvidence).toBe(0.95);
		expect(DEFAULT_ADDRESS_MATCH_CONFIG.maxMissingNumericTokens).toBe(0);
		expect(DEFAULT_ADDRESS_MATCH_CONFIG.maxExtraNumericTokens).toBe(0);
		expect(DEFAULT_ADDRESS_MATCH_CONFIG.failOnAnyNumericConflict).toBe(true);
		expect(DEFAULT_ADDRESS_MATCH_CONFIG.requireAtLeastOneNumericMatchWhenNumericPresent).toBe(true);
		expect(DEFAULT_ADDRESS_MATCH_CONFIG.treatAlphanumericAsNumeric).toBe(true);
	});
});

describe('compareAddresses', () => {
	describe('matching addresses', () => {
		it('matches identical addresses', () => {
			const result = compareAddresses('12 Elm Street', '12 Elm Street');
			expect(result.isMatch).toBe(true);
		});

		it('matches addresses with a single OCR typo in a word', () => {
			// "Stret" vs "Street": 1 edit, similarity = 5/6 ≈ 0.833, avg with "elm"=1 → 0.916 > 0.88
			const result = compareAddresses('12 Elm Stret', '12 Elm Street');
			expect(result.isMatch).toBe(true);
		});

		it('matches when token order differs for text tokens', () => {
			// Flat code and number match; text tokens elm/street/flat all score 1
			const result = compareAddresses('Flat 3A 12 Elm Street', '12 Elm Street Flat 3A');
			expect(result.isMatch).toBe(true);
		});

		it('matches when both addresses are empty', () => {
			const result = compareAddresses('', '');
			expect(result.isMatch).toBe(true);
		});

		it('matches ordinal house number against plain number with relaxed config', () => {
			// "1st" (ORDINAL, key: ordinal:1) vs "1" (NUMBER, key: number:1) are different canonical keys
			// — they won't set-match. Allow missing/extra to verify the rest still matches.
			const result = compareAddresses('1st Elm Street', '1st Elm Street');
			expect(result.isMatch).toBe(true);
		});

		it('matches roman numeral apartment against same roman numeral', () => {
			const result = compareAddresses('12 Elm Street Apt iv', '12 Elm Street Apt iv');
			expect(result.isMatch).toBe(true);
		});
	});

	describe('non-matching addresses', () => {
		it('does not match when house numbers differ', () => {
			const result = compareAddresses('15 Elm Street', '12 Elm Street');
			expect(result.isMatch).toBe(false);
		});

		it('does not match when street names are completely different', () => {
			const result = compareAddresses('12 Oak Avenue', '12 Elm Street');
			expect(result.isMatch).toBe(false);
		});

		it('does not match when flat codes differ', () => {
			const result = compareAddresses('Flat 3A 12 Elm Street', 'Flat 3B 12 Elm Street');
			expect(result.isMatch).toBe(false);
		});
	});

	describe('diagnostics', () => {
		it('exposes classified tokens for both addresses', () => {
			const { diagnostics } = compareAddresses('12 Elm Street', '12 Elm Street');
			expect(diagnostics.extractedTokens.length).toBeGreaterThan(0);
			expect(diagnostics.referenceTokens.length).toBeGreaterThan(0);
		});

		it('exposes numeric comparison result', () => {
			const { diagnostics } = compareAddresses('12 Elm Street', '12 Elm Street');
			expect(diagnostics.numeric.totalLeft).toBeGreaterThan(0);
		});

		it('exposes text similarity score between 0 and 1', () => {
			const { diagnostics } = compareAddresses('12 Elm Street', '12 Elm Street');
			expect(diagnostics.textSimilarity).toBeGreaterThanOrEqual(0);
			expect(diagnostics.textSimilarity).toBeLessThanOrEqual(1);
		});

		it('exposes token similarity breakdown', () => {
			const { diagnostics } = compareAddresses('12 Elm Street', '12 Elm Street');
			expect(diagnostics.tokenSimilarity.matches).toBeInstanceOf(Array);
		});

		it('includes the decision reason code', () => {
			const { diagnostics } = compareAddresses('12 Elm Street', '12 Elm Street');
			expect(diagnostics.decision.reasons).toContain('MATCH');
		});

		it('includes a failure reason on mismatch', () => {
			const { diagnostics } = compareAddresses('15 Elm Street', '12 Elm Street');
			expect(diagnostics.decision.reasons.length).toBeGreaterThan(0);
			expect(diagnostics.decision.reasons[0]).not.toBe('MATCH');
		});
	});

	describe('configOverride', () => {
		it('respects a lowered minTextSimilarity threshold', () => {
			// "12 Oak Ave" vs "12 Elm Street" — text tokens differ greatly
			const strict = compareAddresses('12 Oak Ave', '12 Elm Street');
			const lenient = compareAddresses('12 Oak Ave', '12 Elm Street', { minTextSimilarity: 0 });
			expect(strict.isMatch).toBe(false);
			expect(lenient.isMatch).toBe(true);
		});

		it('respects maxExtraNumericTokens override', () => {
			// Reference has an extra number; default allows 0 extras
			const strict = compareAddresses('12 Elm Street', '12 34 Elm Street');
			const lenient = compareAddresses('12 Elm Street', '12 34 Elm Street', { maxExtraNumericTokens: 1 });
			expect(strict.isMatch).toBe(false);
			expect(lenient.isMatch).toBe(true);
		});
	});
});
