/** Classification of a token extracted from an address string. */
export type TokenType = 'NUMBER' | 'ORDINAL' | 'ROMAN_NUMERAL' | 'ALPHANUMERIC' | 'WORD';

/** A single token produced by {@link tokenizeAddress} and classified by {@link classifyToken}. */
export interface ClassifiedToken {
	/** The original lowercase token string. */
	raw: string;
	/** Zero-based position of this token in the tokenized address. */
	index: number;
	/** Semantic classification of the token. */
	type: TokenType;
	/** Parsed integer value for numeric types; `null` for WORD and ALPHANUMERIC tokens. */
	numericValue: number | null;
}

/** A {@link ClassifiedToken} that carries a canonical key used for numeric comparison. */
export interface NumericTokenInfo extends ClassifiedToken {
	/**
	 * Stable string key that two numerically-equivalent tokens share.
	 * Format: `"<type>:<value>"`, e.g. `"number:12"`, `"ordinal:12"`, `"roman:4"`, `"alphanumeric:a1b"`.
	 */
	canonicalKey: string;
}

/** A positional mismatch between two numeric tokens at the same index. */
export interface NumericConflict {
	/** Numeric token from the extracted (left) address. */
	left: NumericTokenInfo;
	/** Numeric token from the reference (right) address. */
	right: NumericTokenInfo;
	/** The reason the conflict was raised. */
	reason: 'MISMATCHED_NUMERIC_IDENTIFIER';
}

/** Detailed outcome of comparing the numeric tokens of two addresses. */
export interface NumericComparisonResult {
	/** Tokens present in both addresses with the same canonical key. */
	matches: NumericTokenInfo[];
	/** Tokens present in the extracted address but absent from the reference. */
	missingInRight: NumericTokenInfo[];
	/** Tokens present in the reference address but absent from the extracted address. */
	extraInRight: NumericTokenInfo[];
	/** Positional mismatches between numeric tokens at corresponding indices. */
	conflicts: NumericConflict[];
	/** Total number of numeric tokens in the extracted (left) address. */
	totalLeft: number;
	/** Total number of numeric tokens in the reference (right) address. */
	totalRight: number;
}

/** Tuning parameters for {@link compareAddresses}. */
export interface AddressMatchConfig {
	/** Minimum token-wise text similarity score (0–1) required when numeric evidence is present. */
	minTextSimilarity: number;
	/** Minimum token-wise text similarity score (0–1) required when no numeric tokens exist in either address. */
	minTextSimilarityWhenNoNumericEvidence: number;
	/** Maximum number of numeric tokens allowed to be absent from the reference address. */
	maxMissingNumericTokens: number;
	/** Maximum number of extra numeric tokens allowed in the reference address. */
	maxExtraNumericTokens: number;
	/** Reject the match immediately if any positional numeric conflict is detected. */
	failOnAnyNumericConflict: boolean;
	/** Require at least one shared numeric token when either address contains numeric tokens. */
	requireAtLeastOneNumericMatchWhenNumericPresent: boolean;
	/** Treat ALPHANUMERIC tokens (e.g. `"a1b"`) as numeric identifiers rather than text. */
	treatAlphanumericAsNumeric: boolean;
}

/** The binary match decision together with the chain of reasons that led to it. */
export interface AddressMatchDecision {
	/** `true` if the addresses are considered a match. */
	isMatch: boolean;
	/**
	 * Ordered list of reason codes.
	 * Final code is `"MATCH"` on success, or one of:
	 * `"NUMERIC_CONFLICT"`, `"TOO_MANY_MISSING_NUMERIC_TOKENS"`, `"TOO_MANY_EXTRA_NUMERIC_TOKENS"`,
	 * `"NO_NUMERIC_OVERLAP"`, `"TEXT_SIMILARITY_BELOW_THRESHOLD"`.
	 */
	reasons: string[];
}

/** Full intermediate state produced during a {@link compareAddresses} call. */
export interface AddressMatchDiagnostics {
	/** Classified tokens from the extracted address. */
	extractedTokens: ClassifiedToken[];
	/** Classified tokens from the reference address. */
	referenceTokens: ClassifiedToken[];
	/** Result of the numeric-token comparison step. */
	numeric: NumericComparisonResult;
	/** Non-numeric tokens kept for text similarity from the extracted address. */
	textTokensExtracted: string[];
	/** Non-numeric tokens kept for text similarity from the reference address. */
	textTokensReference: string[];
	/** Final normalised text similarity score (0–1). */
	textSimilarity: number;
	/** Per-token breakdown of the text similarity computation. */
	tokenSimilarity: TextTokenSimilarityResult;
	/** The final match decision. */
	decision: AddressMatchDecision;
}

/** Top-level return value of {@link compareAddresses}. */
export interface AddressMatchResult {
	/** `true` if the addresses are considered a match. */
	isMatch: boolean;
	/** Full diagnostics for debugging or auditing the decision. */
	diagnostics: AddressMatchDiagnostics;
}

/** Best-match result for a single reference token against all extracted tokens. */
export interface TextTokenMatch {
	/** The reference token being scored. */
	referenceToken: string;
	/** The extracted token that achieved the highest similarity, or `null` if there were no extracted tokens. */
	bestExtractedToken: string | null;
	/** Similarity score (0–1) between `referenceToken` and `bestExtractedToken`. */
	score: number;
}

/** Aggregate result of the token-wise text similarity pass. */
export interface TextTokenSimilarityResult {
	/** Sum of per-token best scores. */
	totalScore: number;
	/** `totalScore` divided by the number of reference tokens (0–1). */
	normalizedScore: number;
	/** Per-reference-token match details. */
	matches: TextTokenMatch[];
}
