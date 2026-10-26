import { z } from 'zod';
export const customerEmailSchema = z.string().trim().email('Enter a valid email address').max(254);