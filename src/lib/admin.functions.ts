import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Returns true when the caller holds the admin role (server-side check, never trust the client). */
export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: data === true, userId: context.userId };
  });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (data !== true) throw new Error("Forbidden: administrator access required");
}

async function writeAudit(
  actorId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: Record<string, unknown>,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    target_type: targetType ?? null,
    target_id: targetId ?? null,
    details: (details ?? null) as never,
  } as never);
}

/** Aggregated admin dashboard payload. */
export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    const dayAgo = new Date(Date.now() - 864e5).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

    const [users, posts, comments, messages, reports, banned, newUsers, recentPosts] =
      await Promise.all([
        sb.from("profiles").select("*", { count: "exact", head: true }),
        sb.from("posts").select("*", { count: "exact", head: true }),
        sb.from("comments").select("*", { count: "exact", head: true }),
        sb.from("messages").select("*", { count: "exact", head: true }),
        sb.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
        sb.from("profiles").select("*", { count: "exact", head: true }).eq("is_banned", true),
        sb.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
        sb.from("posts").select("*", { count: "exact", head: true }).gte("created_at", dayAgo),
      ]);

    const { data: activity } = await sb
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8);

    const { data: trending } = await sb
      .from("hashtags")
      .select("*")
      .order("usage_count", { ascending: false })
      .limit(8);

    return {
      stats: {
        users: users.count ?? 0,
        posts: posts.count ?? 0,
        comments: comments.count ?? 0,
        messages: messages.count ?? 0,
        reports: reports.count ?? 0,
        banned: banned.count ?? 0,
        newUsers: newUsers.count ?? 0,
        postsToday: recentPosts.count ?? 0,
      },
      activity: activity ?? [],
      trending: trending ?? [],
    };
  });

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ q: z.string().max(80).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let query = context.supabase
      .from("profiles")
      .select(
        "id, username, display_name, full_name, avatar_url, country, is_banned, is_suspended, suspended_until, email_verified, phone_verified, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(60);
    if (data.q) query = query.ilike("username", `%${data.q}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminListPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ flaggedOnly: z.boolean().default(false) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let query = context.supabase
      .from("posts")
      .select("id, content, media_url, is_hidden, ai_score, ai_flags, created_at, author_id, profiles(username, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data.flaggedOnly) query = query.not("ai_score", "is", null).gte("ai_score", 0.5);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as Record<string, any>[];
  });

export const adminListReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(80);
    return data ?? [];
  });

export const adminListAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(150);
    return data ?? [];
  });

export const adminGetSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase.from("platform_settings").select("*");
    return data ?? [];
  });

const actionSchema = z.object({
  action: z.enum([
    "ban_user",
    "unban_user",
    "suspend_user",
    "unsuspend_user",
    "verify_user",
    "delete_post",
    "hide_post",
    "unhide_post",
    "resolve_report",
    "dismiss_report",
    "update_setting",
  ]),
  targetId: z.string().min(1),
  value: z.any().optional(),
});

/** Every privileged mutation goes through here and is written to the audit log. */
export const adminAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => actionSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const t = data.targetId;

    switch (data.action) {
      case "ban_user":
        await supabaseAdmin.from("profiles").update({ is_banned: true } as never).eq("id", t);
        break;
      case "unban_user":
        await supabaseAdmin.from("profiles").update({ is_banned: false } as never).eq("id", t);
        break;
      case "suspend_user": {
        const days = Number(data.value ?? 7);
        await supabaseAdmin
          .from("profiles")
          .update({
            is_suspended: true,
            suspended_until: new Date(Date.now() + days * 864e5).toISOString(),
          } as never)
          .eq("id", t);
        break;
      }
      case "unsuspend_user":
        await supabaseAdmin
          .from("profiles")
          .update({ is_suspended: false, suspended_until: null } as never)
          .eq("id", t);
        break;
      case "verify_user":
        await supabaseAdmin
          .from("profiles")
          .update({ email_verified: true } as never)
          .eq("id", t);
        break;
      case "delete_post":
        await supabaseAdmin.from("posts").delete().eq("id", t);
        break;
      case "hide_post":
        await supabaseAdmin.from("posts").update({ is_hidden: true } as never).eq("id", t);
        break;
      case "unhide_post":
        await supabaseAdmin.from("posts").update({ is_hidden: false } as never).eq("id", t);
        break;
      case "resolve_report":
        await supabaseAdmin.from("reports").update({ status: "resolved" } as never).eq("id", t);
        break;
      case "dismiss_report":
        await supabaseAdmin.from("reports").update({ status: "dismissed" } as never).eq("id", t);
        break;
      case "update_setting":
        await supabaseAdmin
          .from("platform_settings")
          .upsert({ key: t, value: data.value as never, updated_at: new Date().toISOString() } as never);
        break;
    }

    await writeAudit(context.userId, data.action, "record", t, { value: data.value ?? null });
    return { ok: true };
  });

/** Records admin sign-in / sign-out events. */
export const adminLogEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ action: z.enum(["admin_login", "admin_logout"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await writeAudit(context.userId, data.action);
    return { ok: true };
  });

/** Whether the single administrator account has been provisioned yet. */
export const adminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");
  return { exists: (count ?? 0) > 0 };
});

/**
 * One-time provisioning of the single administrator account.
 * Requires the server-side ADMIN_SETUP_KEY and refuses to run once an admin exists.
 */
export const provisionAdmin = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(10),
        setupKey: z.string().min(10),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env["ADMIN_SETUP_KEY"];
    if (!key || data.setupKey !== key) throw new Error("Invalid setup key");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("An administrator already exists");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create administrator");

    const uid = created.user.id;
    const handle = `admin_${uid.slice(0, 6)}`;
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: uid, username: handle, display_name: "Administrator", email_verified: true } as never);
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: "admin" } as never);
    if (roleErr) throw new Error(roleErr.message);

    await writeAudit(uid, "admin_provisioned", "user", uid);
    return { ok: true };
  });
