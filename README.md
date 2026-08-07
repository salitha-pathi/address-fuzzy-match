[![npm version](https://img.shields.io/npm/v/address-fuzzy-match)](https://www.npmjs.com/package/address-fuzzy-match)
[![Test & Coverage CI](https://github.com/salitha-pathi/address-fuzzy-match/actions/workflows/test.yml/badge.svg)](https://github.com/salitha-pathi/address-fuzzy-match/actions/workflows/test.yml)
[![npm downloads](https://img.shields.io/npm/dm/address-fuzzy-match)](https://www.npmjs.com/package/address-fuzzy-match)
[![License](https://img.shields.io/npm/l/address-fuzzy-match)](https://github.com/salitha-pathi/address-fuzzy-match/blob/main/LICENSE)

[![Socket Badge](https://socket.dev/api/badge/npm/package/address-fuzzy-match)](https://socket.dev/npm/package/address-fuzzy-match)
[![codecov](https://codecov.io/github/salitha-pathi/address-fuzzy-match/branch/main/graph/badge.svg?token=N775X84TOQ)](https://codecov.io/github/salitha-pathi/address-fuzzy-match)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/salitha-pathi/address-fuzzy-match/badge)](https://securityscorecards.dev/viewer/?uri=github.com/salitha-pathi/address-fuzzy-match)

[![GitHub stars](https://img.shields.io/github/stars/salitha-pathi/address-fuzzy-match?style=social)](https://github.com/salitha-pathi/address-fuzzy-match/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/salitha-pathi/address-fuzzy-match?style=social)](https://github.com/salitha-pathi/address-fuzzy-match/network/members)
# Address Fuzzy Match

Match an extracted (e.g. OCR) postal address against an authoritative reference address.

The library tokenises both addresses, compares numeric identifiers (house numbers, flat codes, roman numerals) strictly, and scores the remaining text tokens using normalised Levenshtein distance. A configurable set of acceptance rules produces a boolean verdict together with full diagnostics.

## Installation

```bash
npm install address-fuzzy-match
```

## Quick start

```ts
import { compareAddresses } from 'address-fuzzy-match';

const result = compareAddresses(
  '12 Elm St, Springfield',    // OCR-extracted
  '12 Elm Street, Springfield' // postal reference
);

console.log(result.isMatch);                    // true
console.log(result.diagnostics.textSimilarity); // ~0.93
```

## How it works

Each comparison runs three sequential steps:

1. **Tokenise & classify** — both strings are split into lowercase alphanumeric chunks. Each chunk is classified as `NUMBER`, `ORDINAL` (`1st`, `2nd`, …), `ROMAN_NUMERAL`, `ALPHANUMERIC` (mixed letters/digits, e.g. `a1b`), or `WORD`.

2. **Numeric comparison** — numeric tokens are compared for set membership and positional order. Conflicts (same position, different value), missing tokens, and extra tokens are recorded separately.

3. **Text similarity** — non-numeric tokens from the reference are each matched against the best-scoring extracted token using normalised Levenshtein distance. The average produces a score in `[0, 1]`.

A set of configurable rules (see [Configuration](#configuration)) is then applied to the numeric diff and the text score to reach a final decision.

## API

### `compareAddresses(extractedAddress, referenceAddress, configOverride?)`

Main entry point.

| Parameter | Type | Description |
|---|---|---|
| `extractedAddress` | `string` | Address from OCR or another imperfect source |
| `referenceAddress` | `string` | Authoritative postal address |
| `configOverride` | `Partial<AddressMatchConfig>` | Optional overrides merged with the defaults |

Returns `AddressMatchResult`:

```ts
{
  isMatch: boolean;
  diagnostics: AddressMatchDiagnostics; // full intermediate state
}
```

### Lower-level exports

All internal pipeline functions are exported for testing or custom orchestration:

| Export | Description |
|---|---|
| `tokenizeAddress(address)` | Split an address into lowercase tokens |
| `classifyToken(raw, index)` | Classify a single token |
| `classifyTokens(tokens)` | Classify an array of tokens |
| `extractNumericTokens(tokens, config)` | Extract numeric-type tokens |
| `compareNumericTokens(left, right)` | Diff two numeric token arrays |
| `extractTextTokens(tokens, config)` | Extract text-only tokens |
| `computeTokenWiseSimilarity(extracted, reference)` | Token-wise similarity score |
| `computeTokenSimilarity(a, b)` | Normalised Levenshtein similarity for two tokens |
| `levenshteinDistance(a, b)` | Raw Levenshtein edit distance |
| `decideAddressMatch(numeric, textSimilarity, config)` | Apply acceptance rules |

## Configuration

`compareAddresses` accepts an optional `Partial<AddressMatchConfig>` merged over `DEFAULT_ADDRESS_MATCH_CONFIG`:

| Option | Default | Description |
|---|---|---|
| `minTextSimilarity` | `0.88` | Minimum text score when numeric evidence is present |
| `minTextSimilarityWhenNoNumericEvidence` | `0.95` | Minimum text score when neither address has numeric tokens |
| `maxMissingNumericTokens` | `0` | Allowed number of numeric tokens absent from the reference |
| `maxExtraNumericTokens` | `0` | Allowed number of extra numeric tokens in the reference |
| `failOnAnyNumericConflict` | `true` | Reject immediately on any positional numeric mismatch |
| `requireAtLeastOneNumericMatchWhenNumericPresent` | `true` | Require at least one shared numeric token |
| `treatAlphanumericAsNumeric` | `true` | Treat tokens like `a1b` as numeric identifiers |

```ts
import { compareAddresses } from 'address-fuzzy-match';

const result = compareAddresses(extracted, reference, {
  minTextSimilarity: 0.80,         // looser text threshold
  maxExtraNumericTokens: 1,        // allow one extra number in the reference
});
```

### Decision reason codes

`result.diagnostics.decision.reasons` contains one of the following codes:

| Code | Meaning |
|---|---|
| `MATCH` | All rules passed |
| `NUMERIC_CONFLICT` | Positional numeric mismatch detected |
| `TOO_MANY_MISSING_NUMERIC_TOKENS` | Too many numeric tokens absent from the reference |
| `TOO_MANY_EXTRA_NUMERIC_TOKENS` | Too many unexpected numeric tokens in the reference |
| `NO_NUMERIC_OVERLAP` | No shared numeric tokens despite both addresses containing them |
| `TEXT_SIMILARITY_BELOW_THRESHOLD` | Text similarity score too low |

## License

[MIT](LICENSE)
