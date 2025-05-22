import { UserWithExtras } from '@/db/types';
import { userService } from '@/lib/services/userService';
import { getAccessToken } from '@/scripts/seed';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export type EntraUser = {
  businessPhones: string[];
  displayName: string;
  givenName: string;
  jobTitle: string;
  mail: string;
  mobilePhone: string | null;
  officeLocation: string | null;
  preferredLanguage: string | null;
  surname: string;
  userPrincipalName: string;
  id: string;
};

const s3 = new S3Client({
  region: 'eu-central',
  endpoint: process.env.HETZNER_BUCKET_URL!,
  credentials: {
    accessKeyId: process.env.HETZNER_BUCKET_ACCESS_KEY!,
    secretAccessKey: process.env.HETZNER_BUCKET_SECRET_KEY!,
  },
});

export async function GET() {
  const accessToken = await getAccessToken();
  let allNeonUsers = [];
  let allEntraUsers = [];

  try {
    allNeonUsers = await userService.getAllUsers();
  } catch (error) {
    console.error('Error fetching neon users:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch neon users';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users?$filter=endswith(mail,'@charlietango.dk') and givenName ne null and jobTitle ne null&$count=true`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ConsistencyLevel: 'eventual',
        },
      }
    );
    allEntraUsers = await res.json();
  } catch (error) {
    console.error('Error fetching Entra users:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch Entra users';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const updates = await Promise.all(
    allNeonUsers.map(async (neonUser: UserWithExtras) => {
      const entraUser = allEntraUsers.value.find(
        (entra: EntraUser) => entra.id === neonUser.userId
      );

      if (!entraUser) return null;

      const updateData: Partial<UserWithExtras> = {};

      if (neonUser.firstName !== entraUser.givenName) {
        updateData.firstName = entraUser.givenName;
      }

      if (neonUser.lastName !== entraUser.surname) {
        updateData.lastName = entraUser.surname;
      }
      if (neonUser.email !== entraUser.mail) {
        updateData.email = entraUser.mail;
      }
      if (neonUser.organisationRoles?.[0] !== entraUser.jobTitle) {
        updateData.organisationRoles = [entraUser.jobTitle];
      }

      if (neonUser.businessPhoneNumber !== entraUser.businessPhones) {
        updateData.businessPhoneNumber = entraUser.businessPhones;
      }

      if (neonUser.mobilePhone !== entraUser.mobilePhone) {
        updateData.mobilePhone = entraUser.mobilePhone;
      }

      if (neonUser.profilePicture === null) {
        try {
          const photoResponse = await fetch(
            `https://graph.microsoft.com/v1.0/users/${neonUser.userId}/photo/$value`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          if (photoResponse.ok) {
            const photoBuffer = Buffer.from(await photoResponse.arrayBuffer());

            const processedBuffer = await sharp(photoBuffer)
              .resize(256, 256, { fit: 'cover' })
              .webp({ quality: 80 })
              .toBuffer();
            const mimeType = photoResponse.headers.get('content-type') || 'image/jpeg';
            const key = `profile-images/${neonUser.userId}`;

            await s3.send(
              new PutObjectCommand({
                Bucket: process.env.HETZNER_BUCKET_NAME!,
                Key: key,
                Body: processedBuffer,
                ContentType: mimeType,
                ACL: 'public-read', // Make public
              })
            );

            updateData.profilePicture = `${process.env.HETZNER_BUCKET_URL!.replace(/\/$/, '')}/${process.env.HETZNER_BUCKET_NAME}/${key}`;
          }
        } catch (error) {
          console.error(`Failed to fetch profile photo for ${neonUser.email}:`, error);
        }
      }

      if (Object.keys(updateData).length > 0) {
        try {
          await userService.updateUser(neonUser.userId, updateData);
          return { userId: neonUser.userId, updatedFields: updateData };
        } catch (err) {
          console.error('Failed to update user', neonUser.userId, err);
          return { userId: neonUser.userId, error: err instanceof Error ? err.message : err };
        }
      }
    })
  );

  const updatedUsers = updates.filter(Boolean);

  return NextResponse.json({
    updatedUsers,
    count: updatedUsers.length,
  });
}
