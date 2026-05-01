import React from 'react';

export interface PageWrapperProps {
  children: React.ReactNode;
}

export const PageWrapper: React.FC<PageWrapperProps> = ({ children }) => {
  const mainStyle: React.CSSProperties = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px 16px',
    width: '100%',
    boxSizing: 'border-box',
  };

  return <main style={mainStyle}>{children}</main>;
};

export default PageWrapper;
