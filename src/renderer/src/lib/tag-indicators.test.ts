import { describe, expect, it } from 'vitest'
import { indicatorsOf, parseTagIndicators, serializeTagIndicators, TAG_INDICATORS } from './tag-indicators'

const everything = { rating: 3, tagged: { places: true, people: true, other: true } }

describe('REQ-017-01, REQ-017-02: indicatorsOf', () => {
  it('shows the picked indicators in a fixed order, with one star per rating point and their names', () => {
    expect(indicatorsOf(everything, { shown: true, picked: ['tags', 'people', 'places', 'rating'] })).toEqual([
      { kind: 'rating', stars: 3, label: 'Rated 3 out of 5' },
      { kind: 'places', label: 'Has places' },
      { kind: 'people', label: 'Has people' },
      { kind: 'tags', label: 'Has tags' },
    ])
    expect(indicatorsOf(everything, { shown: true, picked: ['people'] }).map((it) => it.kind)).toEqual(['people'])
  })

  it('leaves out what the media item lacks', () => {
    const item = { rating: null, tagged: { places: false, people: true, other: false } }
    expect(indicatorsOf(item, { shown: true, picked: [...TAG_INDICATORS] }).map((it) => it.kind)).toEqual(['people'])
    expect(indicatorsOf({ ...item, rating: 0 }, { shown: true, picked: ['rating'] })).toEqual([])
  })

  it('shows nothing while tag indicators are off', () => {
    expect(indicatorsOf(everything, { shown: false, picked: [...TAG_INDICATORS] })).toEqual([])
  })
})

describe('REQ-017-03: stored choice', () => {
  it('is off with all indicators picked until the user changes it', () => {
    expect(parseTagIndicators(null)).toEqual({ shown: false, picked: [...TAG_INDICATORS] })
    expect(parseTagIndicators('not json')).toEqual({ shown: false, picked: [...TAG_INDICATORS] })
  })

  it('round-trips, keeping the picks while off and dropping unknown ones', () => {
    const choice = { shown: false, picked: ['people' as const, 'rating' as const] }
    expect(parseTagIndicators(serializeTagIndicators(choice))).toEqual(choice)
    expect(parseTagIndicators('{"shown":true,"picked":["rating","gps"]}')).toEqual({ shown: true, picked: ['rating'] })
    expect(parseTagIndicators('{"shown":true,"picked":[]}')).toEqual({ shown: true, picked: [] })
  })
})
