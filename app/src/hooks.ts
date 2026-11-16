import { isFixtureMode } from './data/fixtureMockup';

/** False under `?fixture=mockup`: every new UI element on an existing screen is wrapped in this. */
export function useShowNew(): boolean {
  return !isFixtureMode();
}
