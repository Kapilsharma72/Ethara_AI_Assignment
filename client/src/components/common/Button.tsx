import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, React.CSSProperties> = {
  primary: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: '1px solid #2563eb',
  },
  secondary: {
    backgroundColor: '#ffffff',
    color: '#374151',
    border: '1px solid #d1d5db',
  },
  danger: {
    backgroundColor: '#dc2626',
    color: '#ffffff',
    border: '1px solid #dc2626',
  },
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, React.CSSProperties> = {
  sm: { padding: '4px 10px', fontSize: '13px', borderRadius: '4px' },
  md: { padding: '8px 16px', fontSize: '14px', borderRadius: '6px' },
  lg: { padding: '12px 24px', fontSize: '16px', borderRadius: '8px' },
};

const SpinnerIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    style={{
      animation: 'spin 0.75s linear infinite',
      display: 'inline-block',
      verticalAlign: 'middle',
    }}
  >
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
    <path
      d="M12 2a10 10 0 0 1 10 10"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  children,
  style,
  ...rest
}) => {
  const isDisabled = disabled || isLoading;

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontWeight: 500,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.6 : 1,
    transition: 'opacity 0.15s, background-color 0.15s',
    outline: 'none',
    lineHeight: 1.25,
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...style,
  };

  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 20 : 16;

  return (
    <button
      {...rest}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      style={baseStyle}
    >
      {isLoading && <SpinnerIcon size={iconSize} />}
      {children}
    </button>
  );
};

export default Button;
