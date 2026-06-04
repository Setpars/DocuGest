import * as z from 'zod'

/** Politique de mot de passe (création / modification). */
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

export const PASSWORD_POLICY_HINT =
  '8 caractères minimum, une majuscule, une minuscule, un chiffre et un caractère spécial (!@#$%^&*…).'

const HAS_LOWER = /[a-z]/
const HAS_UPPER = /[A-Z]/
const HAS_DIGIT = /\d/
const HAS_SPECIAL = /[^A-Za-z0-9]/

export function validatePasswordStrength(password: string): { valid: boolean, message?: string } {
  if (!password) {
    return { valid: false, message: 'Le mot de passe est obligatoire.' }
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, message: `Au moins ${PASSWORD_MIN_LENGTH} caractères.` }
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { valid: false, message: `Maximum ${PASSWORD_MAX_LENGTH} caractères.` }
  }
  if (!HAS_LOWER.test(password)) {
    return { valid: false, message: 'Au moins une lettre minuscule.' }
  }
  if (!HAS_UPPER.test(password)) {
    return { valid: false, message: 'Au moins une lettre majuscule.' }
  }
  if (!HAS_DIGIT.test(password)) {
    return { valid: false, message: 'Au moins un chiffre.' }
  }
  if (!HAS_SPECIAL.test(password)) {
    return { valid: false, message: 'Au moins un caractère spécial.' }
  }
  return { valid: true }
}

/** Schéma Zod pour les formulaires (vee-validate). */
export const passwordFieldSchema = z
  .string()
  .min(1, 'Le mot de passe est obligatoire')
  .superRefine((value, ctx) => {
    const result = validatePasswordStrength(value)
    if (!result.valid) {
      ctx.addIssue({
        code: 'custom',
        message: result.message ?? PASSWORD_POLICY_HINT,
      })
    }
  })

/** Validation côté service avant appel Firebase Auth. */
export function assertPasswordPolicy(password: string) {
  const result = validatePasswordStrength(password)
  if (!result.valid) {
    throw new Error(result.message ?? PASSWORD_POLICY_HINT)
  }
}
