import { describe, expect, it } from 'vitest'
import { neighbours, type Preloadable, Preloader, pickPreview } from './preload'

class FakeImage implements Preloadable {
  src = ''
  decoded = 0
  decode() {
    this.decoded++
    return Promise.resolve()
  }
}

function fakePreloader() {
  const images: FakeImage[] = []
  const preloader = new Preloader(() => {
    const image = new FakeImage()
    images.push(image)
    return image
  })
  return { preloader, images, loading: () => images.filter((image) => image.src).map((image) => image.src) }
}

describe('REQ-009-13: neighbours', () => {
  it('lists the items up to two places around the current one, nearest first', () => {
    expect(neighbours(6, 2)).toEqual([3, 1, 4, 0])
  })

  it('stops at the ends of the gallery', () => {
    expect(neighbours(6, 0)).toEqual([1, 2])
    expect(neighbours(6, 5)).toEqual([4, 3])
  })

  it('is empty for an item outside the gallery', () => {
    expect(neighbours(6, -1)).toEqual([])
  })
})

describe('REQ-009-13: Preloader', () => {
  it('starts loading and decoding every url', () => {
    const { preloader, images, loading } = fakePreloader()
    preloader.set(['a', 'b'])
    expect(loading()).toEqual(['a', 'b'])
    expect(images.map((image) => image.decoded)).toEqual([1, 1])
  })

  it('keeps urls that are still wanted instead of loading them again', () => {
    const { preloader, images } = fakePreloader()
    preloader.set(['a', 'b'])
    preloader.set(['b', 'c'])
    expect(images.map((image) => image.src)).toEqual(['', 'b', 'c'])
  })

  it('abandons urls that are no longer wanted', () => {
    const { preloader, loading } = fakePreloader()
    preloader.set(['a', 'b'])
    preloader.set([])
    expect(loading()).toEqual([])
  })
})

describe('REQ-009-14: pickPreview', () => {
  const sizes = ['large', 'small']

  it('takes the sharpest thumbnail that is already loaded', () => {
    expect(pickPreview(sizes, (url: string) => url === 'small')).toBe('small')
    expect(pickPreview(sizes, () => true)).toBe('large')
  })

  it('takes the largest thumbnail when none is loaded yet', () => {
    expect(pickPreview(sizes, () => false)).toBe('large')
  })
})
