import { describe, expect, it } from 'vitest';
import { signUpErrors } from './signUpValidation';

const valid = { username: 'yogi', email: 'yogi@example.com', password: 'tennis123', confirmPassword: 'tennis123' };

describe('signUpErrors', () => {
  it('passes a complete form', () => {
    expect(signUpErrors(valid)).toEqual({});
  });

  it('flags every empty field as required', () => {
    expect(signUpErrors({ username: '', email: ' ', password: '', confirmPassword: '' })).toEqual({
      username: 'required',
      email: 'required',
      password: 'required',
      confirmPassword: 'required',
    });
  });

  it('flags a malformed email, a short password and a mismatch', () => {
    expect(signUpErrors({ ...valid, email: 'yogi@', password: 'abc', confirmPassword: 'abd' })).toEqual({
      email: 'invalid',
      password: 'too-short',
      confirmPassword: 'mismatch',
    });
  });

  it('trims the email before checking it', () => {
    expect(signUpErrors({ ...valid, email: '  yogi@example.com ' })).toEqual({});
  });
});
