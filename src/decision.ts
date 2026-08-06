import type { NumericComparisonResult, AddressMatchDecision, AddressMatchConfig } from './types';

/**
 * Apply the configured acceptance rules to produce a final match/no-match decision.
 *
 * Rules are evaluated in the following order (first failure wins):
 * 1. **Numeric conflict** — any positional numeric mismatch, if `failOnAnyNumericConflict` is set.
 * 2. **Missing numeric tokens** — too many numeric tokens absent from the reference.
 * 3. **Extra numeric tokens** — too many unexpected numeric tokens in the reference.
 * 4. **No numeric overlap** — no shared numeric tokens despite both addresses containing them.
 * 5. **Text similarity** — the token-wise text score falls below the configured threshold.
 *
 * When numeric evidence is absent from both addresses the stricter
 * `minTextSimilarityWhenNoNumericEvidence` threshold is used.
 *
 * @param numeric - Result of the numeric-token comparison step.
 * @param textSimilarity - Normalised text similarity score (0–1).
 * @param config - Active match configuration.
 */
export function decideAddressMatch(
	numeric: NumericComparisonResult,
	textSimilarity: number,
	config: AddressMatchConfig,
): AddressMatchDecision {
	const reasons: string[] = [];
	const hasNumericEvidence = numeric.totalLeft > 0 || numeric.totalRight > 0;

	if (config.failOnAnyNumericConflict && numeric.conflicts.length > 0) {
		reasons.push('NUMERIC_CONFLICT');
		return { isMatch: false, reasons };
	}

	if (numeric.missingInRight.length > config.maxMissingNumericTokens) {
		reasons.push('TOO_MANY_MISSING_NUMERIC_TOKENS');
		return { isMatch: false, reasons };
	}

	if (numeric.extraInRight.length > config.maxExtraNumericTokens) {
		reasons.push('TOO_MANY_EXTRA_NUMERIC_TOKENS');
		return { isMatch: false, reasons };
	}

	if (hasNumericEvidence && config.requireAtLeastOneNumericMatchWhenNumericPresent && numeric.matches.length === 0) {
		reasons.push('NO_NUMERIC_OVERLAP');
		return { isMatch: false, reasons };
	}

	const threshold = hasNumericEvidence ? config.minTextSimilarity : config.minTextSimilarityWhenNoNumericEvidence;

	if (textSimilarity < threshold) {
		reasons.push('TEXT_SIMILARITY_BELOW_THRESHOLD');
		return { isMatch: false, reasons };
	}

	reasons.push('MATCH');
	return { isMatch: true, reasons };
}
