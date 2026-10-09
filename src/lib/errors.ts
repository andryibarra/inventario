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
  invalid_price: 'El precio no es válido.',
  invalid_unit: 'La unidad no es válida.',
  invalid_sku: 'La referencia debe tener máximo 60 caracteres.',
  invalid_barcode: 'El código de barras debe tener máximo 60 caracteres.',
  invalid_threshold: 'El aviso de stock bajo no es válido.',
  invalid_quantity: 'La cantidad no es válida.',
  invalid_unit_cost: 'El costo por unidad no es válido.',
  invalid_reason: 'Escribe un motivo de máximo 200 caracteres.',
  invalid_category_name: 'El nombre de la categoría debe tener entre 1 y 60 caracteres.',
  invalid_movement_type: 'Ese tipo de movimiento no se puede registrar aquí.',
  duplicate_sku: 'Ya tienes otro producto con esa referencia.',
  duplicate_barcode: 'Ya tienes otro producto con ese código de barras.',
  duplicate_product: 'Ese producto ya existe.',
  duplicate_category: 'Ya existe una categoría con ese nombre.',
  category_not_found: 'La categoría ya no existe. Recarga la página.',
  product_not_found: 'El producto ya no existe. Recarga la página.',
  product_inactive: 'El producto está archivado. Reactívalo para registrar entradas o salidas.',
  insufficient_stock: 'No hay suficientes unidades disponibles para esa salida.',
  no_change: 'La cantidad contada es igual a la que ya tienes. No hay nada que ajustar.',
  import_empty: 'El archivo no tiene productos para importar.',
  import_too_many_rows: 'El archivo tiene más de 2.000 productos. Divídelo en partes.',
  import_invalid_options:
    'Para reemplazar las cantidades también debes permitir actualizar los productos existentes.',
  import_invalid_row: 'Una fila del archivo no tiene el formato esperado.',
  import_ambiguous_match: 'La referencia y el código de barras corresponden a productos distintos.',
  invalid_import_id: 'No pudimos identificar la importación. Vuelve a empezar.',
  invalid_file_name: 'El nombre del archivo no es válido.',
}

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'Primero confirma tu correo con el enlace que te enviamos.',
  user_already_exists: 'Ya existe una cuenta con ese correo.',
  email_exists: 'Ya existe una cuenta con ese correo.',
  weak_password: 'La contraseña es muy débil. Usa al menos 8 caracteres.',
  same_password: 'La nueva contraseña debe ser diferente a la anterior.',
  over_email_send_rate_limit:
    'Enviamos demasiados correos. Espera unos minutos e intenta de nuevo.',
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
