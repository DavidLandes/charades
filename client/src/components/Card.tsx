import type { ReactNode, HTMLAttributes } from 'react';
import './Card.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  active?: boolean;
}

export default function Card({ children, active, className = '', ...props }: CardProps) {
  return (
    <div className={`card ${active ? 'card-active' : ''} ${className}`} {...props}>
      {children}
    </div>
  );
}
