// localStorage puede no existir o lanzar (modo privado, sitio bloqueado).
// Solo se usa para comodidades, nunca para datos que deban persistir.

export function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Sin almacenamiento local: la app sigue funcionando sin recordar la preferencia.
  }
}
