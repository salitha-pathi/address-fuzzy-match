import type { ClassifiedToken, AddressMatchConfig, TextTokenSimilarityResult, TextTokenMatch } from './types';

/**
 * Extract the text-only tokens from a classified token array, excluding numeric identifiers.
 *
 * Tokens of type `NUMBER`, `ORDINAL`, and `ROMAN_NUMERAL` are always excluded.
 * `ALPHANUMERIC` tokens are also excluded when `config.treatAlphanumericAsNumeric` is `true`.
 * The remaining tokens are used for the text similarity comparison step.
 *
 * @param tokens - Classified tokens from one address.
 * @param config - Active match configuration.
 */
export function extractTextTokens(tokens: ClassifiedToken[], config: AddressMatchConfig): string[] {
	return tokens
		.filter((token) => {
			if (token.type === 'NUMBER' || token.type === 'ORDINAL' || token.type === 'ROMAN_NUMERAL') {
				return false;
			}
			if (token.type === 'ALPHANUMERIC' && config.treatAlphanumericAsNumeric) {
				return false;
			}
			return true;
		})
		.map((token) => token.raw);
}

/**
 * Compute token-wise similarity between two text token arrays.
 *
 * For each reference token the best-matching extracted token is found using
 * {@link computeTokenSimilarity} (normalised Levenshtein). The final
 * `normalizedScore` is the average of per-token best scores.
 *
 * Edge cases:
 * - Empty reference → perfect score `1` (nothing to mismatch).
 * - Empty extracted → zero score with all matches having `bestExtractedToken: null`.
 *
 * @param extractedTokens - Text tokens from the OCR/extracted address.
 * @param referenceTokens - Text tokens from the postal reference address.
 */
export function computeTokenWiseSimilarity(
	extractedTokens: string[],
	referenceTokens: string[],
): TextTokenSimilarityResult {
	if (referenceTokens.length === 0) {
		return {
			totalScore: 1,
			normalizedScore: 1,
			matches: [],
		};
	}

	if (extractedTokens.length === 0) {
		return {
			totalScore: 0,
			normalizedScore: 0,
			matches: referenceTokens.map((referenceToken) => ({
				referenceToken,
				bestExtractedToken: null,
				score: 0,
			})),
		};
	}

	const matches: TextTokenMatch[] = [];
	let totalScore = 0;

	for (const referenceToken of referenceTokens) {
		let bestScore = 0;
		let bestExtractedToken: string | null = null;

		for (const extractedToken of extractedTokens) {
			const score = computeTokenSimilarity(extractedToken, referenceToken);
			if (score > bestScore) {
				bestScore = score;
				bestExtractedToken = extractedToken;
			}
			if (bestScore === 1) break;
		}

		totalScore += bestScore;
		matches.push({
			referenceToken,
			bestExtractedToken,
			score: bestScore,
		});
	}

	return {
		totalScore,
		normalizedScore: totalScore / referenceTokens.length,
		matches,
	};
}

/**
 * Compute the similarity between two individual tokens as a value in `[0, 1]`.
 *
 * Uses normalised Levenshtein distance: `1 - distance / max(len(a), len(b))`.
 * Returns `1` for identical tokens and `0` when every character must change.
 *
 * @param extractedToken - Token from the extracted address.
 * @param referenceToken - Token from the reference address.
 */
export function computeTokenSimilarity(extractedToken: string, referenceToken: string): number {
	if (extractedToken === referenceToken) return 1;

	const maxLength = Math.max(extractedToken.length, referenceToken.length);
	if (maxLength === 0) return 1;

	const distance = levenshteinDistance(extractedToken, referenceToken);
	return Math.max(0, 1 - distance / maxLength);
}

/**
 * Compute the Levenshtein (edit) distance between two strings.
 *
 * Uses a full `m × n` dynamic-programming matrix.
 * Time complexity: O(m·n). Space complexity: O(m·n).
 *
 * @param a - First string.
 * @param b - Second string.
 * @returns Minimum number of single-character edits (insert, delete, substitute) to transform `a` into `b`.
 */
export function levenshteinDistance(a: string, b: string): number {
	if (a === b) return 0;
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;

	const rows = a.length + 1;
	const cols = b.length + 1;
	const dp: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

	for (let i = 0; i < rows; i++) dp[i][0] = i;
	for (let j = 0; j < cols; j++) dp[0][j] = j;

	for (let i = 1; i < rows; i++) {
		for (let j = 1; j < cols; j++) {
			const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
			dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + substitutionCost);
		}
	}

	return dp[a.length][b.length];
}
