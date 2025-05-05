import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/Sheet/sheet';

type StatusSidebarProps = {
  open: string;
  setOpen: (value: string) => void;
};

export function StatusSidebar({ open, setOpen }: StatusSidebarProps) {
  return (
    <Sheet
      open={open === 'status'}
      onOpenChange={() => setOpen(open === 'navigation' ? 'status' : 'navigation')}
    >
      <SheetTrigger>Open</SheetTrigger>
      <SheetContent className={'bg-black'}>
        <SheetHeader>
          <SheetTitle>Are you absolutely sure?</SheetTitle>
          <SheetDescription>
            This action cannot be undone. This will permanently delete your account and remove your
            data from our servers.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
}
