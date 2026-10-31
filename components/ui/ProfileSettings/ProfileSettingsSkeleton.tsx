import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { PALETTES } from '@/lib/theme/palettes';
import './profile-settings.css';

/** Placeholder for ProfileSettings while the signed-in profile loads. Same layout, no interaction. */
export function ProfileSettingsSkeleton() {
  return (
    <section className="profile-settings" aria-hidden="true">
      <div className="profile-settings__heading">
        <span>Settings</span>
        <h2>Appearance</h2>
      </div>

      <div className="profile-settings__group">
        <p className="profile-settings__legend">Mode</p>
        <div className="profile-settings__modes">
          {[0, 1].map((index) => (
            <div className="settings-choice mode-card" key={index}>
              <Skeleton className="h-[18px] w-[18px]" />
              <SkeletonText className="w-12" />
            </div>
          ))}
        </div>
      </div>

      <div className="profile-settings__group">
        <p className="profile-settings__legend">Palette</p>
        <p className="profile-settings__hint">
          Every palette comes in light and dark. Your choice is saved in this browser.
        </p>
        <div className="profile-settings__palettes">
          {PALETTES.map(({ id }) => (
            <div className="settings-choice palette-card" key={id}>
              <Skeleton className="h-(--palette-preview-height) w-full rounded-md" />
              <span className="palette-card__label">
                <SkeletonText className="w-16" />
              </span>
              <span className="palette-card__description">
                <SkeletonText className="w-24" />
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
