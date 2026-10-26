/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { customerEmailSchema } from './customerEmail';
test('reminder rejects an invalid email before saving or sending', () => {
  expect(customerEmailSchema.safeParse('not-an-email').success).toBe(false);
  expect(customerEmailSchema.safeParse('').success).toBe(false);
});
test('reminder validates and trims a supplied customer email', () => {
  expect(customerEmailSchema.parse(' customer@example.com ')).toBe('customer@example.com');
});