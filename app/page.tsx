import { Test } from '@/components/ui/Test/Test';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div>
      <Button variant="default" className={'font-mono'}>
        Button
      </Button>

      <Test />
    </div>
  );
}
