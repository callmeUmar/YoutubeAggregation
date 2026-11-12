import { type ReactNode, useId } from 'react';
import './components.css';

interface CardProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Rendered next to the title, e.g. a DEMO DATA tag. */
  badge?: ReactNode;
}

/** A titled dashboard section. The title labels the region for assistive tech. */
export function Card({ title, description, actions, children, className, badge }: CardProps) {
  const titleId = useId();
  return (
    <section className={['card', className].filter(Boolean).join(' ')} aria-labelledby={titleId}>
      <header className="card__header">
        <div className="card__heading">
          <h2 id={titleId} className="card__title">
            {title}
            {badge}
          </h2>
          {description && <p className="card__description">{description}</p>}
        </div>
        {actions && <div className="card__actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}
