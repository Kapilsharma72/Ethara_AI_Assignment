import React from 'react';

export interface BadgeProps {
  variant: 'status' | 'priority';
  value: string;
}

// Status badge colors — WCAG AA compliant (dark text on light bg, or white on dark bg)
const statusColors: Record<string, React.CSSProperties> = {
  'To Do': { backgroundColor: '#f3f4f6', color: '#374151' },       // grey
  'In Progress': { backgroundColor: '#dbeafe', color: '#1e40af' }, // blue
  'Done': { backgroundColor: '#d1fae5', color: '#065f46' },        // green
};

// Priority badge colors — WCAG AA compliant
const priorityColors: Record<string, React.CSSProperties> = {
  'Low': { backgroundColor: '#d1fae5', color: '#065f46' },         // green
  'Medium': { backgroundColor: '#fef3c7', color: '#92400e' },      // amber
  'High': { backgroundColor: '#fee2e2', color: '#991b1b' },        // red
};

const fallbackColors: React.CSSProperties = { backgroundColor: '#f3f4f6', color: '#374151' };

export const Badge: React.FC<BadgeProps> = ({ variant, value }) => {
  const colors =
    variant === 'status'
      ? (statusColors[value] ?? fallbackColors)
      : (priorityColors[value] ?? fallbackColors);

  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    fontSize: '12px',
    fontWeight: 600,
    borderRadius: '9999px',
    whiteSpace: 'nowrap',
    ...colors,
  };

  return <span style={style}>{value}</span>;
};

export default Badge;
