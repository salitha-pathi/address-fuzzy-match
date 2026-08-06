import { tokenizeAddress, classifyToken, classifyTokens } from '../tokenizer';

describe('tokenizeAddress', () => {
	it('returns empty array for empty string', () => {
		expect(tokenizeAddress('')).toEqual([]);
	});

	it('returns empty array for whitespace-only string', () => {
		expect(tokenizeAddress('   ')).toEqual([]);
	});

	it('splits on spaces', () => {
		expect(tokenizeAddress('12 Elm Street')).toEqual(['12', 'elm', 'street']);
	});

	it('splits on punctuation so "no.12" and "no 12" are equivalent', () => {
		expect(tokenizeAddress('no.12')).toEqual(['no', '12']);
		expect(tokenizeAddress('no 12')).toEqual(['no', '12']);
	});

	it('lowercases all tokens', () => {
		expect(tokenizeAddress('ELM STREET')).toEqual(['elm', 'street']);
	});

	it('handles comma-separated address parts', () => {
		expect(tokenizeAddress('12 Elm St, Springfield')).toEqual(['12', 'elm', 'st', 'springfield']);
	});

	it('handles multiple consecutive separators', () => {
		expect(tokenizeAddress('no.  12,  apt.  3A')).toEqual(['no', '12', 'apt', '3a']);
	});

	it('handles mixed case with digits', () => {
		expect(tokenizeAddress('Flat 3A')).toEqual(['flat', '3a']);
	});
});

describe('classifyToken', () => {
	describe('NUMBER', () => {
		it('classifies single-digit integers', () => {
			expect(classifyToken('0', 0)).toEqual({ raw: '0', index: 0, type: 'NUMBER', numericValue: 0 });
		});

		it('classifies multi-digit integers', () => {
			expect(classifyToken('12', 0)).toEqual({ raw: '12', index: 0, type: 'NUMBER', numericValue: 12 });
			expect(classifyToken('100', 0)).toMatchObject({ type: 'NUMBER', numericValue: 100 });
		});
	});

	describe('ORDINAL', () => {
		it('classifies 1st', () => {
			expect(classifyToken('1st', 0)).toMatchObject({ type: 'ORDINAL', numericValue: 1 });
		});

		it('classifies 2nd', () => {
			expect(classifyToken('2nd', 0)).toMatchObject({ type: 'ORDINAL', numericValue: 2 });
		});

		it('classifies 3rd', () => {
			expect(classifyToken('3rd', 0)).toMatchObject({ type: 'ORDINAL', numericValue: 3 });
		});

		it('classifies 4th and higher -th ordinals', () => {
			expect(classifyToken('4th', 0)).toMatchObject({ type: 'ORDINAL', numericValue: 4 });
			expect(classifyToken('11th', 0)).toMatchObject({ type: 'ORDINAL', numericValue: 11 });
			expect(classifyToken('21st', 0)).toMatchObject({ type: 'ORDINAL', numericValue: 21 });
		});
	});

	describe('ROMAN_NUMERAL', () => {
		it('classifies single-character roman numerals', () => {
			expect(classifyToken('i', 0)).toMatchObject({ type: 'ROMAN_NUMERAL', numericValue: 1 });
			expect(classifyToken('v', 0)).toMatchObject({ type: 'ROMAN_NUMERAL', numericValue: 5 });
			expect(classifyToken('x', 0)).toMatchObject({ type: 'ROMAN_NUMERAL', numericValue: 10 });
		});

		it('classifies subtractive forms', () => {
			expect(classifyToken('iv', 0)).toMatchObject({ type: 'ROMAN_NUMERAL', numericValue: 4 });
			expect(classifyToken('ix', 0)).toMatchObject({ type: 'ROMAN_NUMERAL', numericValue: 9 });
			expect(classifyToken('xl', 0)).toMatchObject({ type: 'ROMAN_NUMERAL', numericValue: 40 });
			expect(classifyToken('xc', 0)).toMatchObject({ type: 'ROMAN_NUMERAL', numericValue: 90 });
		});

		it('classifies multi-character roman numerals', () => {
			expect(classifyToken('xii', 0)).toMatchObject({ type: 'ROMAN_NUMERAL', numericValue: 12 });
			expect(classifyToken('xlii', 0)).toMatchObject({ type: 'ROMAN_NUMERAL', numericValue: 42 });
			expect(classifyToken('mmxxiv', 0)).toMatchObject({ type: 'ROMAN_NUMERAL', numericValue: 2024 });
		});
	});

	describe('ALPHANUMERIC', () => {
		it('classifies tokens with both letters and digits', () => {
			expect(classifyToken('a1b', 0)).toMatchObject({ type: 'ALPHANUMERIC', numericValue: null });
			expect(classifyToken('flat2a', 0)).toMatchObject({ type: 'ALPHANUMERIC', numericValue: null });
			expect(classifyToken('3a', 0)).toMatchObject({ type: 'ALPHANUMERIC', numericValue: null });
		});
	});

	describe('WORD', () => {
		it('classifies pure letter tokens', () => {
			expect(classifyToken('elm', 0)).toMatchObject({ type: 'WORD', numericValue: null });
			expect(classifyToken('street', 0)).toMatchObject({ type: 'WORD', numericValue: null });
			expect(classifyToken('springfield', 0)).toMatchObject({ type: 'WORD', numericValue: null });
		});
	});

	it('preserves the token index', () => {
		expect(classifyToken('elm', 3)).toMatchObject({ index: 3 });
		expect(classifyToken('12', 7)).toMatchObject({ index: 7 });
	});

	it('preserves the raw token string', () => {
		expect(classifyToken('elm', 0)).toMatchObject({ raw: 'elm' });
	});
});

describe('classifyTokens', () => {
	it('returns empty array for empty input', () => {
		expect(classifyTokens([])).toEqual([]);
	});

	it('assigns sequential indices', () => {
		const result = classifyTokens(['12', 'elm', 'street']);
		expect(result[0].index).toBe(0);
		expect(result[1].index).toBe(1);
		expect(result[2].index).toBe(2);
	});

	it('classifies each token with correct type', () => {
		const result = classifyTokens(['12', 'elm', '3rd', 'iv', '3a']);
		expect(result[0].type).toBe('NUMBER');
		expect(result[1].type).toBe('WORD');
		expect(result[2].type).toBe('ORDINAL');
		expect(result[3].type).toBe('ROMAN_NUMERAL');
		expect(result[4].type).toBe('ALPHANUMERIC');
	});

	it('preserves order', () => {
		const tokens = ['street', '12', 'elm'];
		const result = classifyTokens(tokens);
		expect(result.map((t) => t.raw)).toEqual(tokens);
	});
});
