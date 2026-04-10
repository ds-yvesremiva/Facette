// Enable React act() environment for vitest/jsdom
// Required for @testing-library/react renderHook + act to work without warnings
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
