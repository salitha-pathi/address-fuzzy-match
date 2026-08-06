import type { ClassifiedToken } from './types';

const ORDINAL_REGEX = /^(\d+)(st|nd|rd|th)$/;
const NUMBER_REGEX = /^\d+$/;
const ROMAN_REGEX = /^(?=[ivxlcdm]+$)m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/;
const ALPHANUMERIC_REGEX = /^(?=.*[a-z])(?=.*\d)[a-z0-9]+$/;
const WORD_REGEX = /^[a-z]+$/;

/**
 * Split an address string into an array of lowercase alphanumeric tokens.
 *
 * Punctuation and whitespace are treated as delimiters, so `"no.12"` and
 * `"no 12"` both yield `["no", "12"]`.
 *
 * @param address - Raw address string from OCR output or a postal database.
 * @returns Array of lowercase token strings, or an empty array for blank input.
 */
export function tokenizeAddress(address: string): string[] {
	const input = (address ?? '').trim();
	if (!input) return [];

	// Extract lexical chunks so "no.12" and "no 12" become equivalent tokens.
	const chunks = input.match(/[a-z0-9]+/gi) ?? [];
	return chunks.map((chunk) => chunk.toLowerCase());
}

/**
 * Classify a single lowercase token and detect its numeric value when applicable.
 *
 * Classification priority (first match wins):
 * 1. Pure integer → `NUMBER`
 * 2. Ordinal suffix (`1st`, `2nd`, …) → `ORDINAL`
 * 3. Roman numeral → `ROMAN_NUMERAL`
 * 4. Mixed letters and digits → `ALPHANUMERIC`
 * 5. Pure letters → `WORD`
 *
 * @param rawToken - A single lowercase token string.
 * @param index - Zero-based position of the token in its parent token array.
 */
export function classifyToken(rawToken: string, index: number): ClassifiedToken {
	const token = rawToken.trim();

	if (NUMBER_REGEX.test(token)) {
		return { raw: token, index, type: 'NUMBER', numericValue: Number(token) };
	}

	const ordinalMatch = token.match(ORDINAL_REGEX);
	if (ordinalMatch) {
		return { raw: token, index, type: 'ORDINAL', numericValue: Number(ordinalMatch[1]) };
	}

	if (ROMAN_REGEX.test(token)) {
		const value = romanToInteger(token);
		return { raw: token, index, type: 'ROMAN_NUMERAL', numericValue: value };
	}

	if (ALPHANUMERIC_REGEX.test(token)) {
		return { raw: token, index, type: 'ALPHANUMERIC', numericValue: null };
	}

	if (WORD_REGEX.test(token)) {
		return { raw: token, index, type: 'WORD', numericValue: null };
	}

	// Unexpected lexical forms are kept as WORD to avoid silent drops.
	return { raw: token, index, type: 'WORD', numericValue: null };
}

/**
 * Classify an array of tokens produced by {@link tokenizeAddress}.
 *
 * @param tokens - Lowercase token strings.
 * @returns Classified token objects in the same order.
 */
export function classifyTokens(tokens: string[]): ClassifiedToken[] {
	return tokens.map((token, index) => classifyToken(token, index));
}

function romanToInteger(token: string): number | null {
	const values: Record<string, number> = {
		i: 1,
		v: 5,
		x: 10,
		l: 50,
		c: 100,
		d: 500,
		m: 1000,
	};

	let total = 0;
	let previous = 0;

	for (let i = token.length - 1; i >= 0; i--) {
		const current = values[token[i]];
		if (!current) return null;

		if (current < previous) {
			total -= current;
		} else {
			total += current;
			previous = current;
		}
	}

	return total;
}
