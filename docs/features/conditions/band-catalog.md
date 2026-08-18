# Band catalogue, chips, frequency field

## Purpose

Covers the trimmed, ported amateur-HF `bandCatalog.ts`, the `BandChips`
selector, the clamped `FrequencyField`, and the licence-class spec gap.
Not covered here: the `Conditions` model itself (see
[conditions-model.md](conditions-model.md)).

## Code anchors

- `src/core/domain/bandCatalog.ts` — `BandDefinition`, `UK_AMATEUR_BANDS`,
  `bandFromFrequencyMhz`, `isAmateurBand`.
- `src/app/lib/urlState/fields/band.ts` — `bandFieldCodec`.
- `src/app/components/conditions/BandChips.tsx`.
- `src/app/components/conditions/FrequencyField.tsx`.

## Trimmed catalogue

Ported from Codeplug Studio's `src/core/domain/bandCatalog.ts`
(23 amateur entries, 136kHz to mm-wave), trimmed to the ten bands the
engine actually models:

| id | Range (MHz) | Notes |
| --- | --- | --- |
| `160m` | 1.81–2.0 | |
| `80m` | 3.5–3.8 | |
| `60m` | 5.2585–5.4065 | Simple range lookup |
| `40m` | 7.0–7.2 | |
| `30m` | 10.1–10.15 | Secondary allocation |
| `20m` | 14.0–14.35 | |
| `17m` | 18.068–18.168 | |
| `15m` | 21.0–21.45 | |
| `12m` | 24.89–24.99 | |
| `10m` | 28.0–29.7 | |

**Judgment call, flagged:** "HF" here excludes `136khz`/`600m`
(sub-MF/LF — the engine models skywave/ionospheric HF propagation, not
the ground/surface-wave-dominated regime those bands actually use) and
excludes `6m` and above (VHF, outside the engine's modelled regime
entirely). `BandDefinition`'s shape (including `notes`, `color`,
`mantine`) is unchanged from Studio's.

**Deliberately not ported:** `SERVICE_BANDS`/`ALL_BANDS`/`BAND_SECTIONS`
(broadcast/airband/marine/pmr) — this app has no use for them.
`bandPlan.ts`'s separate Hz-keyed wrapper (`BAND_PLAN`,
`bandForFrequencyHz`) — also not ported, flagged as a deviation from the
migration doc's "port as-is" list, since this app already works in MHz
throughout the engine (phase 2/3's `frequencyMhz` convention); a
Hz-keyed wrapper around data already in the right units would be
redundant.

```ts
export interface BandDefinition {
  id: string;
  label: string;
  minMhz: number;
  maxMhz: number;
  color: string;
  mantine: string; // Mantine colour-token name, e.g. 'teal.7'
  category: 'amateur' | 'broadcast' | 'airband' | 'marine' | 'pmr';
  notes?: string;
}
```

`bandFromFrequencyMhz` is a simple linear scan over `UK_AMATEUR_BANDS`
(already ascending-frequency-ordered) — simpler than Studio's own
combined-and-sorted `ALL_BANDS` scan, since this app only has the one
category.

## `BandChips`

One chip per band (kit's `Pill`, `tone="semantic"`, coloured via
`BandDefinition.color`), wrapped in a plain `<button>` for click
handling and `aria-pressed` (Pill's own `onClick` prop only wires up
for `tone="dashed"`, not `"semantic"`). Selecting a chip writes `bandId`
into Conditions-*adjacent* state — `bandId` is a sibling of `conditions`
on `ViewerUrlState`/`ViewerState`, not nested inside it.

### Licence class: visibly distinguished, not hidden

**Flagged as a genuine spec gap, not silently invented:** neither
Station (phase 6) nor Conditions (this phase) defines a per-operator
licence class (UK Foundation/Intermediate/Full? US
Technician/General/Extra?), and no doc in the product doc set specifies
what data model that acceptance criterion expects. This phase's
reasonable, minimal call: render each `BandDefinition.notes` string
(e.g. "Secondary allocation") inline on its chip — Studio's
Ofcom-sourced `notes` field already encodes exactly this kind of
restriction information, surfacing it is a real, truthful "visibly
distinguished" signal without inventing a licence-class selector this
phase has no spec or UI slot for. A real per-operator licence-class
model is a candidate follow-up ticket.

## `FrequencyField`

A numeric field clamped to `[band.minMhz, band.maxMhz]`, same local
draft + commit-on-blur/Enter pattern as `PowerInput`. Not persisted to
the URL — only `bandId` is (`fields/band.ts`); frequency is ephemeral,
owned by `ConditionsBar`, and resets to the newly-selected band's
midpoint whenever the band changes.

**Judgment call, flagged:** defaults to the arithmetic midpoint of the
band's range on first selection / band change — neither the ticket nor
the physics-and-fidelity doc specifies a "typical calling frequency"
convention per band.

## URL codec registration

```ts
// app/lib/urlState/fields/band.ts
export const bandFieldCodec: UrlStateFieldCodec<'bandId'> = {
  key: 'bandId',
  encode(value, params) { if (value) params.set('b', value); },
  decode(params, defaults) {
    const raw = params.get('b');
    return raw && KNOWN_BAND_IDS.has(raw) ? raw : defaults.bandId;
  },
};
```

Unlike Station/Conditions' fields (which are all optional overrides),
`bandId` always has a value — there's no "no band selected" state — so
it's validated against the catalogue rather than treated as
present/absent. `DEFAULT_BAND_ID = '40m'` (`app/lib/urlState/types.ts`):
**judgment call, flagged** — deliberately echoes `DEFAULT_STATION`'s own
default antenna ("40m dipole"), so a fresh visitor's default band and
default antenna are the same band. A malformed or out-of-catalogue `b`
param decodes to the default band rather than throwing.

## Manual verify

```sh
npm run dev
```

- Open "Edit conditions" — ten band chips render, each its own colour;
  `30m` and `60m` show their notes text inline.
- Click a different band — the compact summary and the frequency field
  both update to the new band's midpoint.
- Type a frequency outside the selected band's range and blur — it
  clamps to the nearest bound.
- Reload with `?b=15m` in the URL — the 15m band is pre-selected.

## Related

- [README.md](README.md) — feature hub, implementation status
- [conditions-model.md](conditions-model.md)
