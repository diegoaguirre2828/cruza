// lib/chassis/pedimento/validators.ts — RFC + patente + fracción format validators
import { RegistroValidacion } from './types';

// Mexican RFC pattern.
// Persona moral (legal entity): 12 chars — 3 letras + 6 dígitos (YYMMDD) + 3 alfanuméricos (homoclave).
// Persona física (individual): 13 chars — 4 letras + 6 dígitos (YYMMDD) + 3 alfanuméricos.
const RFC_MORAL = /^[A-ZÑ&]{3}\d{6}[A-Z\d]{3}$/;
const RFC_FISICA = /^[A-ZÑ&]{4}\d{6}[A-Z\d]{3}$/;

export function validateRfc(rfc: string): RegistroValidacion {
  if (!rfc) return 'formato_invalido';
  const r = rfc.toUpperCase().trim();
  if (RFC_MORAL.test(r) || RFC_FISICA.test(r)) {
    return 'pendiente_verificacion';   // format-valid; SAT confirmation is async
  }
  return 'formato_invalido';
}

const PATENTE = /^\d{4}$/;

export function validatePatente(patente: string): RegistroValidacion {
  if (!patente) return 'formato_invalido';
  if (PATENTE.test(patente.trim())) return 'pendiente_verificacion';
  return 'formato_invalido';
}

const FRACCION_LIGIE = /^\d{8}$/;
const NICO = /^\d{2}$/;

export function validateFraccion(fraccion: string): RegistroValidacion {
  if (!fraccion) return 'formato_invalido';
  if (FRACCION_LIGIE.test(fraccion.replace(/\./g, '').trim())) return 'valido';
  return 'formato_invalido';
}

export function validateNico(nico: string): RegistroValidacion {
  if (!nico) return 'formato_invalido';
  if (NICO.test(nico.trim())) return 'valido';
  return 'formato_invalido';
}
