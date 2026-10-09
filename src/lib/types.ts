/**
 * Las columnas de las vistas de Postgres llegan como opcionales en los tipos
 * generados. Marca como no nulas las que la vista garantiza.
 */
export type WithRequired<T, K extends keyof T> = Omit<T, K> & { [P in K]: NonNullable<T[P]> }
