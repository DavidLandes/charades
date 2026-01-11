import type { ReactNode } from 'react';
import './Container.css';

interface ContainerProps {
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export default function Container({ children, size = 'md' }: ContainerProps) {
  return <div className={`container container-${size}`}>{children}</div>;
}
