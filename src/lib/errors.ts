// Traduce errores de Supabase (Auth, PostgREST y las excepciones de nuestras
// funciones SQL) a mensajes en lenguaje cotidiano.

const DB_MESSAGES: Record<string, string> = {
  not_authenticated: 'Tu sesión terminó. Vuelve a ingresar.',
  forbidden: 'No tienes permiso para hacer esta acción.',
  subscription_inactive:
    'Tu suscripción no está activa. Puedes consultar tus datos, pero no hacer cambios.',
  invalid_name: 'El nombre debe tener entre 1 y 120 caracteres.',
  invalid_business_type: 'El tipo de negocio no es válido.',
  invalid_timezone: 'La zona horaria no es válida.',
  invalid_display_name: 'El nombre debe tener máximo 80 caracteres.',
  business_limit_reached: 'Alcanzaste el máximo de negocios por cuenta.',
}

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'Primero confirma tu correo con el enlace que te enviamos.',
  user_already_exists: 'Ya existe una cuenta con ese correo.',
  email_exists: 'Ya existe una cuenta con ese correo.',
  weak_password: 'La contraseña es muy débil. Usa al menos 8 caracteres.',
  same_password: 'La nueva contraseña debe ser diferente a la anterior.',
  over_email_send_rate_limit: 'Enviamos demasiados correos. Espera unos minutos e intenta de nuevo.',
  over_request_rate_limit: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.',
}

export const GENERIC_ERROR = 'Algo salió mal. Intenta de nuevo.'
export const NETWORK_ERROR = 'No pudimos conectarnos. Revisa tu conexión a internet.'

export function toUserMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null) return GENERIC_ERROR

  const { code, message } = error as { code?: unknown; message?: unknown }

  if (typeof message === 'string') {
    const dbMessage = DB_MESSAGES[message]
    if (dbMessage) return dbMessage
    if (message === 'Failed to fetch' || message.includes('NetworkError')) return NETWORK_ERROR
  }
  if (typeof code === 'string') {
    const authMessage = AUTH_MESSAGES[code]
    if (authMessage) return authMessage
  }
  return GENERIC_ERROR
}
