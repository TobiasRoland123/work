import { SkeletonText } from '@/components/ui/skeleton';
import './directory.css';

const pulse = 'animate-pulse motion-reduce:animate-none';

// Fixed placeholder cards. Roles and phone numbers are optional on real cards too.
const cards = [
  { name: 'w-36', organisation: 'w-24', roles: ['w-20', 'w-24'], phone: true },
  { name: 'w-32', organisation: 'w-20', roles: ['w-28'], phone: false },
  { name: 'w-40', organisation: 'w-24', roles: [], phone: true },
  { name: 'w-28', organisation: 'w-16', roles: ['w-24'], phone: true },
  { name: 'w-36', organisation: 'w-24', roles: ['w-16', 'w-20'], phone: false },
  { name: 'w-32', organisation: 'w-20', roles: ['w-28'], phone: true },
];

/** Placeholder for ContactDirectory while colleagues load. */
export function ContactDirectorySkeleton() {
  return (
    <section className="contact-directory" aria-labelledby="contact-directory-title">
      <span role="status" className="sr-only">
        Loading colleagues…
      </span>
      <header className="contact-directory__header">
        <div>
          <p className="contact-directory__eyebrow">People</p>
          <h2 id="contact-directory-title">Contact directory</h2>
          <p className="contact-directory__intro">Find a colleague and get in touch.</p>
        </div>
        <span className="contact-directory__count">
          <SkeletonText className="w-16" />
        </span>
      </header>

      <div className="contact-directory__search" aria-hidden="true">
        <span className="contact-directory__search-icon">⌕</span>
        <span className="flex-1 text-[14px]">
          <SkeletonText className="w-52" />
        </span>
      </div>

      <ul className="contact-directory__grid" aria-hidden="true">
        {cards.map((card, index) => (
          <li className="contact-card" key={index}>
            <div className="contact-card__topline">
              <div className={`contact-card__avatar ${pulse}`} />
              <div className="contact-card__identity flex-1">
                <h3>
                  <SkeletonText className={card.name} />
                </h3>
                <p>
                  <SkeletonText className={card.organisation} />
                </p>
              </div>
            </div>
            {card.roles.length ? (
              <ul className="contact-card__roles">
                {card.roles.map((width) => (
                  <li key={width} className={`${width} ${pulse}`}>
                    &nbsp;
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="contact-card__links text-[13px]">
              <SkeletonText className="w-48" />
              {card.phone && <SkeletonText className="w-28" />}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
