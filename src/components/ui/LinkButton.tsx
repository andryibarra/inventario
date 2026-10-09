import { Link, type LinkProps } from 'react-router'
import { buttonClasses, type ButtonVariant } from './buttonStyles'

type LinkButtonProps = LinkProps & { variant?: ButtonVariant; fullWidth?: boolean }

export function LinkButton({
  variant = 'primary',
  fullWidth = false,
  className = '',
  ...props
}: LinkButtonProps) {
  return <Link className={`${buttonClasses(variant, fullWidth)} ${className}`} {...props} />
}
