// Only import jest-dom in jsdom environment
if (typeof window !== 'undefined') {
  import('@testing-library/jest-dom')
}
