import Link from 'next/link';
import { linkProps } from '@/types/link';
import { StatusDrawer } from '@/components/ui/StatusDrawer/StatusDrawer';

type MobileNavigationProps = {
  linkList?: Array<linkProps>;
  userId?: string;
  onToday?: boolean;
};

export function MobileNavigation({ linkList, userId, onToday = false }: MobileNavigationProps) {
  return (
    <>
      <nav
        className={'bg-black md:hidden w-full text-white fixed bottom-0 font-mono px-6 py-5'}
        aria-label="Mobile Navigation"
      >
        <ul className={'flex gap-8'}>
          {linkList &&
            linkList?.length > 0 &&
            linkList?.map((item, index) => {
              if (!item.href) return;
              return (
                <li key={`${index}_${item.href}`}>
                  <Link href={item.href}>{item?.label}</Link>
                </li>
              );
            })}
        </ul>
      </nav>
      {onToday && <StatusDrawer userId={userId} />}
    </>
  );
}
