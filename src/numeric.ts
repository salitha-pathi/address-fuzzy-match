import type {
	ClassifiedToken,
	NumericTokenInfo,
	NumericComparisonResult,
	NumericConflict,
	AddressMatchConfig,
} from './types';

/**
 * Extract all numeric-type tokens from a classified token array.
 *
 * Which tokens qualify as "numeric" is controlled by `config.treatAlphanumericAsNumeric`:
 * - Always included: `NUMBER`, `ORDINAL`, `ROMAN_NUMERAL`
 * - Conditionally included: `ALPHANUMERIC` (e.g. apartment codes like `"a1b"`)
 *
 * Each returned token is extended with a `canonicalKey` that normalises
 * equivalent representations — `"12"`, `"12th"`, and `"xii"` all share
 * numeric value `12` but get different keys to preserve type semantics.
 *
 * @param tokens - Classified tokens from one address.
 * @param config - Active match configuration.
 */
export function extractNumericTokens(tokens: ClassifiedToken[], config: AddressMatchConfig): NumericTokenInfo[] {
	const numeric: NumericTokenInfo[] = [];

	for (const token of tokens) {
		if (token.type === 'NUMBER') {
			numeric.push({ ...token, canonicalKey: `number:${token.numericValue}` });
			continue;
		}

		if (token.type === 'ORDINAL') {
			numeric.push({ ...token, canonicalKey: `ordinal:${token.numericValue}` });
			continue;
		}

		if (token.type === 'ROMAN_NUMERAL') {
			numeric.push({ ...token, canonicalKey: `roman:${token.numericValue}` });
			continue;
		}

		if (token.type === 'ALPHANUMERIC' && config.treatAlphanumericAsNumeric) {
			numeric.push({ ...token, canonicalKey: `alphanumeric:${token.raw}` });
		}
	}

	return numeric;
}

/**
 * Compare two numeric token arrays and produce a detailed diff.
 *
 * The comparison is done in two passes:
 * 1. **Set pass** — tokens are matched by `canonicalKey` using bucket counting,
 *    producing `matches`, `missingInRight`, and `extraInRight`.
 * 2. **Positional pass** — corresponding tokens at each index are checked for
 *    key mismatches, producing `conflicts`.
 *
 * @param left - Numeric tokens from the extracted address.
 * @param right - Numeric tokens from the reference address.
 */
export function compareNumericTokens(left: NumericTokenInfo[], right: NumericTokenInfo[]): NumericComparisonResult {
	const matches: NumericTokenInfo[] = [];
	const missingInRight: NumericTokenInfo[] = [];
	const extraInRight: NumericTokenInfo[] = [];
	const conflicts: NumericConflict[] = [];

	const rightBuckets = new Map<string, NumericTokenInfo[]>();
	for (const token of right) {
		const existing = rightBuckets.get(token.canonicalKey);
		if (existing) {
			existing.push(token);
		} else {
			rightBuckets.set(token.canonicalKey, [token]);
		}
	}

	for (const token of left) {
		const bucket = rightBuckets.get(token.canonicalKey);
		if (bucket && bucket.length > 0) {
			matches.push(token);
			bucket.shift();
		} else {
			missingInRight.push(token);
		}
	}

	for (const [, bucket] of rightBuckets.entries()) {
		if (bucket.length > 0) {
			extraInRight.push(...bucket);
		}
	}

	const leftComparable = left.filter((token) => token.numericValue !== null);
	const rightComparable = right.filter((token) => token.numericValue !== null);
	const pairCount = Math.min(leftComparable.length, rightComparable.length);

	for (let i = 0; i < pairCount; i++) {
		const leftToken = leftComparable[i];
		const rightToken = rightComparable[i];
		if (leftToken.canonicalKey !== rightToken.canonicalKey) {
			conflicts.push({
				left: leftToken,
				right: rightToken,
				reason: 'MISMATCHED_NUMERIC_IDENTIFIER',
			});
		}
	}

	return {
		matches,
		missingInRight,
		extraInRight,
		conflicts,
		totalLeft: left.length,
		totalRight: right.length,
	};
}
