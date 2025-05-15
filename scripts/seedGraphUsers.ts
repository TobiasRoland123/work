// Adjust path to your db client
import {
  users,
  organisations,
  business_phone_numbers,
  users_business_phone_numbers,
  organisation_roles, // Add this
  users_organisation_roles, // Add this
} from '../db/schema';
import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import { db } from '../db';

import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

interface GraphUser {
  businessPhones: string[];
  displayName: string;
  givenName: string;
  jobTitle: string;
  mail: string;
  mobilePhone: string | null;
  officeLocation: string;
  preferredLanguage: string | null;
  surname: string;
  userPrincipalName: string;
  id: string;
}

async function getGraphUsers() {
  try {
    // Get session token from your Next.js API
    const sessionResponse = await fetch('http://localhost:3000/api/auth/session', {
      headers: {
        Cookie: `authjs.session-token=${process.env.AUTH_SESSION_TOKEN}`,
      },
    });
    const sessionData = await sessionResponse.json();

    if (!sessionData || !sessionData.accessToken) {
      throw new Error(`accessToken missing. Full session response: ${JSON.stringify(sessionData)}`);
    }

    const accessToken = sessionData.accessToken;

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      throw new Error(`Session fetch failed: ${sessionResponse.status} - ${errorText}`);
    }

    if (!accessToken) {
      throw new Error('No access token found in session data');
    }

    // Use the session token to call Graph API
    // Array to collect all users
    let allUsers: GraphUser[] = [];
    let nextLink = `https://graph.microsoft.com/v1.0/users?$filter=endswith(mail,'@charlietango.dk') and givenName ne null and jobTitle ne null&$count=true&$top=100`;

    // Process all pages
    while (nextLink) {
      const res = await fetch(nextLink, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ConsistencyLevel: 'eventual',
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Graph API request failed: ${res.status} - ${errorText}`);
      }

      const userData = await res.json();

      // Add current page of users to our collection
      allUsers = allUsers.concat(userData.value);

      // Check if there are more pages
      nextLink = userData['@odata.nextLink'] || null;
    }

    return { allUsers, accessToken };
  } catch (error) {
    console.error('Error fetching users from Graph API:', error);
    throw error;
  }
}

async function seedGraphUsers() {
  // const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
  try {
    const { allUsers: graphUsers, accessToken } = await getGraphUsers();

    let [organisation] = await db
      .select()
      .from(organisations)
      .where(eq(organisations.organisationName, 'Charlie Tango'));

    if (!organisation) {
      const result = await db
        .insert(organisations)
        .values({ organisationName: 'Charlie Tango' })
        .returning();
      organisation = result[0];
    }

    for (const graphUser of graphUsers) {
      let profilePicture = null;

      try {
        // Try to get profile picture directly from Graph API
        const photoResponse = await fetch(
          `https://graph.microsoft.com/v1.0/users/${graphUser.id}/photo/$value`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`, // You'll need to pass the accessToken to this function
            },
          }
        );

        if (photoResponse.ok) {
          // Get photo as binary data

          const photoBuffer = await photoResponse.arrayBuffer();

          // Convert to base64 string for storage
          profilePicture = `data:image/jpeg;base64,${Buffer.from(photoBuffer).toString('base64')}`;
        }
      } catch (error) {
        console.error(`Failed to fetch profile photo for ${graphUser.mail}:`, error);
      }

      const userData = {
        firstName: graphUser.givenName,
        lastName: graphUser.surname,
        email: graphUser.mail,
        systemRole: 'USER' as const, // Default role
        organisationId: organisation.id,
        mobilePhone: graphUser.mobilePhone?.replaceAll(' ', '') || null, // Store mobile phone directly on user
        profilePicture: profilePicture,
        userId: graphUser.id,
      };

      let user;
      const existingUser = await db.select().from(users).where(eq(users.email, graphUser.mail));

      if (existingUser.length === 0) {
        const result = await db.insert(users).values(userData).returning();
        user = result[0];
      } else {
        user = existingUser[0];
        await db
          .update(users)
          .set({
            firstName: graphUser.givenName,
            lastName: graphUser.surname,
            mobilePhone: graphUser.mobilePhone?.replaceAll(' ', '') || null,
            ...(profilePicture && profilePicture !== user.profilePicture ? { profilePicture } : {}),
            userId: graphUser.id,
          })
          .where(eq(users.id, user.id));
      }

      if (graphUser.jobTitle && graphUser.jobTitle.trim()) {
        const roleName = graphUser.jobTitle.trim();

        // Check if role exists
        let [role] = await db
          .select()
          .from(organisation_roles)
          .where(eq(organisation_roles.role_name, roleName));

        // Insert role if it doesn't exist
        if (!role) {
          const roleResult = await db
            .insert(organisation_roles)
            .values({ role_name: roleName })
            .returning();
          role = roleResult[0];
        }

        // Check if the user already has this role
        const existingRoleLink = await db
          .select()
          .from(users_organisation_roles)
          .where(
            (eq(users_organisation_roles.userId, user.id),
            eq(users_organisation_roles.organisationRoleId, role.id))
          );

        if (existingRoleLink.length === 0) {
          // Link user to role
          await db.insert(users_organisation_roles).values({
            userId: user.id,
            organisationRoleId: role.id,
          });
        }
      }

      await db
        .delete(users_business_phone_numbers)
        .where(eq(users_business_phone_numbers.userId, user.id));

      if (graphUser.businessPhones && graphUser.businessPhones.length > 0) {
        for (const phoneNumber of graphUser.businessPhones) {
          if (!phoneNumber) continue;

          // Check if phone already exists in database
          let [phoneRecord] = await db
            .select()
            .from(business_phone_numbers)
            .where(eq(business_phone_numbers.businessPhoneNumber, phoneNumber));

          // Create phone record if it doesn't exist
          if (!phoneRecord) {
            const phoneResult = await db
              .insert(business_phone_numbers)
              .values({ businessPhoneNumber: phoneNumber.replaceAll(' ', '') })
              .returning();
            phoneRecord = phoneResult[0];
          }

          // Create association between user and phone
          await db.insert(users_business_phone_numbers).values({
            userId: user.id,
            businessPhoneNumberId: phoneRecord.id,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error seeding users:', error);
  } finally {
  }
}

seedGraphUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error during seeding:', error);
    process.exit(1);
  });
