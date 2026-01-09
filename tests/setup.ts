import dotenv from 'dotenv';

// Load test environment
dotenv.config({ path: '.env.dev' });

// Set test environment
process.env.NODE_ENV = 'test';

// Global test setup
beforeAll(async () => {
  // Setup code before all tests
});

// Global test teardown
afterAll(async () => {
  // Cleanup code after all tests
});
