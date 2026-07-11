import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

Object.defineProperties(navigator, {
  language: { configurable: true, value: 'ko-KR' },
  languages: { configurable: true, value: ['ko-KR'] },
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})
