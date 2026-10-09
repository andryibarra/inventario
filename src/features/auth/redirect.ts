/** Solo permite rutas internas para evitar redirecciones abiertas. */
export function safeRedirectPath(from: unknown): string {
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/'
}
