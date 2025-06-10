import { UserWithExtras } from '@/db/types';
import { userService } from '@/lib/services/userService';
import { getAccessToken } from '@/scripts/seed';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

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

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== process.env.CRON_SECRET) {
    console.error('Unauthorized: missing or invalid authorization header in /api/check-users');
    return NextResponse.json(
      { error: 'Unauthorized: missing or invalid authorization header' },
      { status: 401 }
    );
  }
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

      if (Array.isArray(entraUser.businessPhones) && entraUser.businessPhones[0]) {
        const entraPhone = entraUser.businessPhones[0]?.replaceAll(' ', '') || null;
        const neonPhone = neonUser.businessPhoneNumber?.replaceAll(' ', '') || null;
        if (neonPhone !== entraPhone) {
          updateData.businessPhoneNumber = entraPhone;
        }
      }

      if (
        neonUser.mobilePhone?.replaceAll(' ', '') !== entraUser.mobilePhone?.replaceAll(' ', '')
      ) {
        updateData.mobilePhone = entraUser.mobilePhone?.replaceAll(' ', '') || null;
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
            const key = `profile-images/${neonUser.email}`;

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

  // Find Entra users not in Neon
  const neonUserIds = new Set(allNeonUsers.map((u: UserWithExtras) => u.userId));
  const missingEntraUsers = allEntraUsers.value.filter(
    (entra: EntraUser) => !neonUserIds.has(entra.id)
  );

  // Add missing users to Neon
  const createdUsers = await Promise.all(
    missingEntraUsers.map(async (entra: EntraUser) => {
      try {
        let profilePictureUrl: string | null = null;

        // Try to fetch and upload profile picture
        try {
          const photoResponse = await fetch(
            `https://graph.microsoft.com/v1.0/users/${entra.id}/photo/$value`,
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
            const key = `profile-images/${entra.mail}`;

            await s3.send(
              new PutObjectCommand({
                Bucket: process.env.HETZNER_BUCKET_NAME!,
                Key: key,
                Body: processedBuffer,
                ContentType: mimeType,
                ACL: 'public-read',
              })
            );

            profilePictureUrl = `${process.env.HETZNER_BUCKET_URL!.replace(/\/$/, '')}/${process.env.HETZNER_BUCKET_NAME}/${key}`;
          }
        } catch (error) {
          console.error(`Failed to fetch/upload profile photo for ${entra.mail}:`, error);
        }

        const newUser = {
          userId: entra.id,
          firstName: entra.givenName,
          lastName: entra.surname,
          email: entra.mail,
          organisationRoles: [entra.jobTitle],
          businessPhoneNumber: entra.businessPhones?.[0]?.replaceAll(' ', '') || null,
          mobilePhone: entra.mobilePhone?.replaceAll(' ', '') || null,
          profilePicture: profilePictureUrl,
          // ...add other fields as needed
        };
        await userService.createUser(newUser);
        return { userId: entra.id, created: true };
      } catch (err) {
        console.error('Failed to create user', entra.id, err);
        return { userId: entra.id, error: err instanceof Error ? err.message : err };
      }
    })
  );

  // Find Neon users not in Entra
  const entraUserIds = new Set(allEntraUsers.value.map((u: EntraUser) => u.id));
  const removedNeonUsers = allNeonUsers.filter(
    (neonUser: UserWithExtras) => !entraUserIds.has(neonUser.userId)
  );

  // Remove users from Neon
  const deletedUsers = await Promise.all(
    removedNeonUsers.map(async (neonUser: UserWithExtras) => {
      try {
        if (neonUser.profilePicture) {
          const key = `profile-images/${neonUser.email}`;
          try {
            await s3.send(
              new DeleteObjectCommand({
                Bucket: process.env.HETZNER_BUCKET_NAME!,
                Key: key,
              })
            );
          } catch (err) {
            console.error('Failed to delete profile picture from S3 for', neonUser.userId, err);
          }
        }
        await userService.deleteUser(neonUser.userId);
        return { userId: neonUser.userId, deleted: true };
      } catch (err) {
        console.error('Failed to delete user', neonUser.userId, err);
        return { userId: neonUser.userId, error: err instanceof Error ? err.message : err };
      }
    })
  );

  return NextResponse.json({
    updatedUsers,
    createdUsers: createdUsers.filter(Boolean),
    deletedUsers: deletedUsers.filter(Boolean),
    updatedCount: updatedUsers.length,
    createdCount: createdUsers.filter((u) => u && u.created).length,
    deletedCount: deletedUsers.filter((u) => u && u.deleted).length,
  });
}
