import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  id?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  id,
  style,
  ...rest
}) => {
  // Generate a stable id if label is provided but no id given
  const inputId = id ?? (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  const errorId = inputId ? `${inputId}-error` : undefined;

  const inputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    lineHeight: 1.5,
    color: '#111827',
    backgroundColor: '#ffffff',
    border: `1px solid ${error ? '#dc2626' : '#d1d5db'}`,
    borderRadius: '6px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
    ...style,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '4px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
  };

  const errorStyle: React.CSSProperties = {
    marginTop: '4px',
    fontSize: '12px',
    color: '#dc2626',
  };

  return (
    <div style={{ width: '100%' }}>
      {label && (
        <label htmlFor={inputId} style={labelStyle}>
          {label}
        </label>
      )}
      <input
        {...rest}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error && errorId ? errorId : undefined}
        style={inputStyle}
      />
      {error && (
        <p id={errorId} role="alert" style={errorStyle}>
          {error}
        </p>
      )}
    </div>
  );
};

export default Input;
