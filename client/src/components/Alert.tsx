import type { ReactNode } from 'react';
import './Alert.css';

interface AlertProps {
  type: 'error' | 'success' | 'info';
  children: ReactNode;
}

export default function Alert({ type, children }: AlertProps) {
  return <div className={`alert alert-${type}`}>{children}</div>;
}
