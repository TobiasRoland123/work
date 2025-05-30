import { Skeleton } from '@/components/ui/Skeleton/skeleton';

export default function Loading() {
  const skeletonCount = Array.from({ length: 10 });

  return (
    <>
      <div className="px-3 pt-4 pb-7">
        <div className="flex justify-between">
          <div className="flex flex-col items-start gap-2">
            <Skeleton className="w-[6ch] text-base h-5 rounded-full" /> {/* Text label */}
            <Skeleton className="w-[2ch] text-5xl h-12 rounded-lg" /> {/* Number */}
          </div>
          <div>
            <Skeleton className="w-12 h-7 rounded-full" /> {/* Switch */}
          </div>
        </div>
      </div>

      <ul className="grid grid-cols-1 md:grid-cols-2" role="list">
        {skeletonCount.map((_, index) => (
          <li key={index} className="border-b border-gray-400 pb-1">
            <div className="flex items-center gap-3 px-2 py-1 pb-3 border-gray-400">
              {/* Photo */}
              <Skeleton className="w-[60px] h-[60px] shrink-0 self-start mt-3  rounded-full relative bottom-2" />

              <div className="flex flex-col gap-3.5 w-full min-w-0 pt-1">
                {/* Name */}
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="w-[10ch] h-6 text-2xl rounded-full" />
                  <Skeleton className="w-[12ch] h-6 text-2xl rounded-full" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Title */}
                  <Skeleton className="w-[20ch] text-base h-4 rounded-full" />
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mt-3">
                  {/* Contacts */}
                  <Skeleton className="w-[11ch] text-base h-4 rounded-full" />
                  <Skeleton className="w-[19ch] text-base h-4 rounded-full" />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
