import { Skeleton } from '@/components/ui/Skeleton/skeleton';

export default function Loading() {
  const infoFieldSkeleton = Array.from({ length: 5 });

  return (
    <>
      <div className="p-4">
        <div className="flex justify-between">
          <div className="flex flex-col items-start gap-2">
            <Skeleton className="w-[16ch] text-base h-5 rounded-full" /> {/* Text label */}
            <Skeleton className="w-[15ch] text-5xl h-12 rounded-full" /> {/* Number */}
          </div>
        </div>

        <section className="flex flex-col mt-5 gap-2.5">
          {/* ProfileInfoFields */}
          {infoFieldSkeleton.map((_, index) => (
            <div key={index} className="flex gap-10 justify-between border-b border-transparent">
              <div className="mt-5">
                <Skeleton className="w-[8ch] h-4 text-base rounded-full relative bottom-3" />
                {/* Label */}
              </div>
              <div className="flex flex-col justify-end w-full pb-1">
                <Skeleton className="w-full h-8 text-2xl rounded-full" /> {/* Value */}
              </div>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
