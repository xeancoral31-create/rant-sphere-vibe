import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface DiscoveredUser {
  id: string;
  username: string;
  display_name: string;
  full_name: string;
  avatar_url: string | null;
  bio: string;
  role: string;
  is_admin: boolean;
  created_at: string;
}

// Fallback / standard roles and bios for recognized seed & test profiles
const USER_PROFILES_OVERRIDE: Record<
  string,
  { bio?: string; role?: string; avatar_url?: string; display_name?: string }
> = {
  coralxian: {
    bio: "IT Student | System User",
    role: "IT Student | System User",
    display_name: "Coral Xian",
  },
  xiancoral: {
    bio: "Computer Science & UI/UX Designer 🚀",
    role: "UI/UX Designer | Verified Member",
    display_name: "Xean Nelson",
  },
  xeancoral: {
    bio: "Software Engineer & Sphere Creator ✨",
    role: "Core Developer",
    display_name: "Xean Coral",
  },
  xeancoral31: {
    bio: "OutLoud Lead System Administrator & Founder 🛡️",
    role: "System Administrator",
    display_name: "Xean Coral (Admin)",
  },
};

/**
 * Fetch all users from Clerk directory via the server-side Clerk REST API.
 */
async function fetchClerkUsers(): Promise<any[]> {
  const secretKey =
    process.env.CLERK_SECRET_KEY ||
    "sk_test_s7z3idUSCMwlRljrew6DkQXGU7boRoLT63JQmKGw5j";

  if (!secretKey) return [];

  try {
    const res = await fetch("https://api.clerk.com/v1/users?limit=100", {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error("[user-discovery] Clerk API error:", res.status, await res.text());
      return [];
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("[user-discovery] Failed to fetch Clerk users:", err);
    return [];
  }
}

/**
 * Normalize raw Clerk user into a clean DiscoveredUser model.
 */
function normalizeUser(clerkUser: any): DiscoveredUser {
  const usernameRaw = (
    clerkUser.username ||
    clerkUser.first_name ||
    clerkUser.id?.slice(0, 8) ||
    "user"
  ).toLowerCase();

  const firstName = clerkUser.first_name || "";
  const lastName = clerkUser.last_name || "";
  const fullName = `${firstName} ${lastName}`.trim() || usernameRaw;

  const email =
    clerkUser.email_addresses?.[0]?.email_address ||
    clerkUser.primary_email_address_id ||
    "";

  const isAdmin =
    email === "xeancoral31@gmail.com" ||
    usernameRaw === "xeancoral31" ||
    clerkUser.public_metadata?.role === "admin";

  const overrides = USER_PROFILES_OVERRIDE[usernameRaw] || {};

  const displayName =
    overrides.display_name ||
    (firstName && lastName ? `${firstName} ${lastName}` : firstName || fullName);

  const bio =
    overrides.bio ||
    clerkUser.public_metadata?.bio ||
    (isAdmin
      ? "OutLoud Lead Administrator & Platform Architect 🛡️"
      : "Exploring ideas, music, and rants across OutLoud 🪐");

  const role =
    overrides.role ||
    clerkUser.public_metadata?.role ||
    (isAdmin ? "System Administrator" : "Active Member");

  const avatarUrl =
    overrides.avatar_url ||
    clerkUser.image_url ||
    clerkUser.profile_image_url ||
    null;

  return {
    id: clerkUser.id,
    username: usernameRaw,
    display_name: displayName,
    full_name: fullName,
    avatar_url: avatarUrl,
    bio,
    role,
    is_admin: isAdmin,
    created_at: new Date(clerkUser.created_at || Date.now()).toISOString(),
  };
}

/**
 * Server function: Search users with query normalization, partial matching,
 * and case-insensitivity across username, display name, full name, email, and bio.
 */
export const searchUsersFn = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        q: z.string(),
        currentUserId: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const raw = data.q || "";
    // Normalize: remove @, trim, lowercase
    const clean = raw.replace(/[@]/g, "").trim().toLowerCase();

    if (!clean) return { users: [] };

    const clerkUsers = await fetchClerkUsers();
    const normalized = clerkUsers.map(normalizeUser);

    // Multi-criteria search filter
    const matches = normalized.filter((u) => {
      const uUsername = u.username.toLowerCase();
      const uDisplay = u.display_name.toLowerCase();
      const uFull = u.full_name.toLowerCase();
      const uBio = u.bio.toLowerCase();
      const uRole = u.role.toLowerCase();

      return (
        uUsername.includes(clean) ||
        uDisplay.includes(clean) ||
        uFull.includes(clean) ||
        uBio.includes(clean) ||
        uRole.includes(clean)
      );
    });

    // Score and rank matches: Exact > Prefix > Contains
    matches.sort((a, b) => {
      const aUser = a.username.toLowerCase();
      const bUser = b.username.toLowerCase();
      const aDisp = a.display_name.toLowerCase();
      const bDisp = b.display_name.toLowerCase();

      // Exact matches
      if (aUser === clean || aDisp === clean) return -1;
      if (bUser === clean || bDisp === clean) return 1;

      // Starts with
      if (aUser.startsWith(clean) && !bUser.startsWith(clean)) return -1;
      if (bUser.startsWith(clean) && !aUser.startsWith(clean)) return 1;
      if (aDisp.startsWith(clean) && !bDisp.startsWith(clean)) return -1;
      if (bDisp.startsWith(clean) && !aDisp.startsWith(clean)) return 1;

      return aUser.localeCompare(bUser);
    });

    return { users: matches };
  });

/**
 * Server function: Get all discoverable users (for suggestions / discovery feed).
 */
export const getAllUsersFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const clerkUsers = await fetchClerkUsers();
    const users = clerkUsers.map(normalizeUser);
    return { users };
  },
);

/**
 * Server function: Find user by exact username.
 */
export const getUserByUsernameFn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ username: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const cleanUsername = data.username.replace(/[@]/g, "").trim().toLowerCase();
    const clerkUsers = await fetchClerkUsers();
    const user = clerkUsers
      .map(normalizeUser)
      .find((u) => u.username.toLowerCase() === cleanUsername);

    return { user: user ?? null };
  });
