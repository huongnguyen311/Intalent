import { render } from '@testing-library/react'
import App from './App'

test('renders root without crashing', () => {
  render(<App />)
  expect(document.querySelector('#root, [data-app]')).not.toBeNull()
})
