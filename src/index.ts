export type {
	TokenType,
	ClassifiedToken,
	NumericTokenInfo,
	NumericConflict,
	NumericComparisonResult,
	AddressMatchConfig,
	AddressMatchDecision,
	AddressMatchDiagnostics,
	AddressMatchResult,
	TextTokenMatch,
	TextTokenSimilarityResult,
} from './types';

export { tokenizeAddress, classifyToken, classifyTokens } from './tokenizer';
export { extractNumericTokens, compareNumericTokens } from './numeric';
export { extractTextTokens, computeTokenWiseSimilarity, computeTokenSimilarity, levenshteinDistance } from './text';
export { decideAddressMatch } from './decision';

import type { AddressMatchConfig, AddressMatchResult } from './types';
import { tokenizeAddress, classifyTokens } from './tokenizer';
import { extractNumericTokens, compareNumericTokens } from './numeric';
import { extractTextTokens, computeTokenWiseSimilarity } from './text';
import { decideAddressMatch } from './decision';

/** Default tuning values used by {@link compareAddresses} when no override is provided. */
export const DEFAULT_ADDRESS_MATCH_CONFIG: AddressMatchConfig = {
	minTextSimilarity: 0.88,
	minTextSimilarityWhenNoNumericEvidence: 0.95,
	maxMissingNumericTokens: 0,
	maxExtraNumericTokens: 0,
	failOnAnyNumericConflict: true,
	requireAtLeastOneNumericMatchWhenNumericPresent: true,
	treatAlphanumericAsNumeric: true,
};

/**
 * Determine whether an extracted address (e.g. from OCR) matches a postal reference address.
 *
 * The comparison runs three sequential steps:
 * 1. **Tokenise & classify** — both addresses are split into lowercase tokens and each token
 *    is labelled as a number, ordinal, roman numeral, alphanumeric code, or plain word.
 * 2. **Numeric comparison** — numeric tokens are compared for set membership and positional
 *    ordering. Conflicts, missing tokens, and extra tokens are recorded.
 * 3. **Text similarity** — the remaining non-numeric tokens are compared token-wise using
 *    normalised Levenshtein distance to produce a similarity score in `[0, 1]`.
 *
 * A final {@link AddressMatchDecision} is produced by applying the acceptance rules from
 * `config` (see {@link AddressMatchConfig} for the full list of thresholds and flags).
 *
 * @example
 * ```ts
 * import { compareAddresses } from 'address-match';
 *
 * const result = compareAddresses(
 *   '12 Elm St, Springfield',   // OCR-extracted
 *   '12 Elm Street, Springfield' // postal reference
 * );
 *
 * console.log(result.isMatch);              // true
 * console.log(result.diagnostics.textSimilarity); // ~0.93
 * ```
 *
 * @param extractedAddress - Address string obtained from OCR or another imperfect source.
 * @param referenceAddress - Authoritative postal address to match against.
 * @param configOverride - Optional partial config merged over {@link DEFAULT_ADDRESS_MATCH_CONFIG}.
 * @returns Match result with a boolean verdict and full diagnostics.
 */
export function compareAddresses(
	extractedAddress: string,
	referenceAddress: string,
	configOverride: Partial<AddressMatchConfig> = {},
): AddressMatchResult {
	const config: AddressMatchConfig = { ...DEFAULT_ADDRESS_MATCH_CONFIG, ...configOverride };

	const extractedTokens = classifyTokens(tokenizeAddress(extractedAddress));
	const referenceTokens = classifyTokens(tokenizeAddress(referenceAddress));

	const numericExtracted = extractNumericTokens(extractedTokens, config);
	const numericReference = extractNumericTokens(referenceTokens, config);
	const numeric = compareNumericTokens(numericExtracted, numericReference);

	const textTokensExtracted = extractTextTokens(extractedTokens, config);
	const textTokensReference = extractTextTokens(referenceTokens, config);
	const tokenSimilarity = computeTokenWiseSimilarity(textTokensExtracted, textTokensReference);
	const textSimilarity = tokenSimilarity.normalizedScore;

	const decision = decideAddressMatch(numeric, textSimilarity, config);

	return {
		isMatch: decision.isMatch,
		diagnostics: {
			extractedTokens,
			referenceTokens,
			numeric,
			textTokensExtracted,
			textTokensReference,
			textSimilarity,
			tokenSimilarity,
			decision,
		},
	};
}
