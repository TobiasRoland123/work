import { SkeletonText } from '@/components/ui/skeleton';
import './profile-info.css';

// Name, department, title, phone, and mail, in the order ProfileInfo lists them.
const fields = [
  { label: 'w-10', value: 'w-56' },
  { label: 'w-20', value: 'w-40' },
  { label: 'w-10', value: 'w-64' },
  { label: 'w-12', value: 'w-36' },
  { label: 'w-10', value: 'w-72' },
];

/** Placeholder for ProfileInfo while the signed-in profile loads. */
export function ProfileInfoSkeleton() {
  return (
    <section className="profile-info">
      <span role="status" className="sr-only">
        Loading your profile…
      </span>
      <div className="profile-info__hero">
        <div className="profile-info__avatar-wrap">
          <div
            className="profile-info__avatar animate-pulse motion-reduce:animate-none"
            aria-hidden="true"
          />
          <small>Profile photo is synced from Slack</small>
        </div>
        <div className="profile-info__heading min-w-0 flex-1">
          <span>Your information</span>
          <h2>
            <SkeletonText className="w-[min(26rem,100%)]" />
          </h2>
        </div>
      </div>

      <div className="profile-info__fields" aria-hidden="true">
        {fields.map((field, index) => (
          <div className="profile-info__field" key={index}>
            <div className="profile-info__field-label">
              <p>
                <SkeletonText className={field.label} />
              </p>
            </div>
            <div className="profile-info__field-value">
              <p>
                <SkeletonText className={field.value} />
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
