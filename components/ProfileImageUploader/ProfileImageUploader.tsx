'use client';
import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { uploadAndProcessProfileImageAction } from '@/app/actions/userActions';
import { toast } from 'sonner';
import { cn } from '@/lib/className';

const ProfileImageUploader = ({
  currentImage,
  alt,
  userEmail,
}: {
  currentImage: string | null;
  alt: string;
  userEmail?: string;
}) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && userEmail) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
      try {
        const user = await uploadAndProcessProfileImageAction(file, userEmail);
        setIsUploading(false);
        if (user) {
          toast('Your profile image was updated successfully. 💪✨');
        }
      } catch (err) {
        setPreview(null);
        toast('Something went wrong while updating your image, try again later 🥲🚫');
        setIsUploading(false);
        throw new Error('Something went wrong while updating your image, try again later 🥲🚫', {
          cause: err,
        });
      }
    }
  };

  return (
    <div className="grid grid-cols-1 grid-rows-1 items-center ">
      {currentImage ? (
        <Image
          src={preview || currentImage}
          alt={alt}
          width={250}
          priority
          height={250}
          className={cn(
            'mx-auto rounded-full col-start-1 row-start-1 aspect-square object-cover',
            isUploading ? 'opacity-10' : null
          )}
        />
      ) : null}
      {isUploading ? (
        <div className="col-start-1 row-start-1 mx-auto mt-auto">
          <span className="font-mono p-4 rounded-lg bg-blue animate-pulse">Updating...</span>
        </div>
      ) : (
        <Label
          htmlFor="profilePicture"
          className="col-start-1 row-start-1 bg-white-blue font-mono p-4 rounded-lg mx-auto mt-auto"
        >
          Update profile picture
        </Label>
      )}
      <Input
        id="profilePicture"
        type="file"
        accept="image/*"
        ref={fileInputRef}
        max-size={3145728}
        onInput={(e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file && file.size > 3145728) {
            toast('File size must be less than 3MB 💾🚫');
            (e.target as HTMLInputElement).value = '';
          }
        }}
        onChange={handleFileChange}
        className="col-start-1 row-start-1 size-full opacity-0  cursor-pointer"
      />
    </div>
  );
};

export default ProfileImageUploader;
