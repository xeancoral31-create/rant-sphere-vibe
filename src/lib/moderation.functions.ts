import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  postId: z.string().uuid().optional(),
  commentId: z.string().uuid().optional(),
  text: z.string().min(1).max(2000),
});

interface ModerationResult {
  toxicity: number;
  spam: number;
  hate: number;
  nsfw: number;
  reasoning: string;
}

// Calls Lovable AI Gateway for moderation. Uses structured JSON output.
export const moderateContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "AI not configured" as const, hidden: false };
    }

    const systemPrompt = `You are a strict content moderator for a public social network. Rate the following user content on four axes from 0.0 (safe) to 1.0 (severe). Be conservative: short or borderline content scores low. Return ONLY a JSON object with keys: toxicity, spam, hate, nsfw, reasoning (one short sentence).`;

    let result: ModerationResult | null = null;
    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: data.text },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        console.error("[moderation] gateway error", resp.status, errText);
        return { ok: false, error: "gateway_error" as const, hidden: false };
      }
      const json = await resp.json();
      const content = json?.choices?.[0]?.message?.content;
      result = JSON.parse(content);
    } catch (e) {
      console.error("[moderation] parse error", e);
      return { ok: false, error: "parse_error" as const, hidden: false };
    }
    if (!result) return { ok: false, error: "no_result" as const, hidden: false };

    const max = Math.max(result.toxicity ?? 0, result.hate ?? 0, result.nsfw ?? 0, result.spam ?? 0);
    const shouldHide = max >= 0.75;
    const shouldFlag = max >= 0.5;

    const { supabase } = context;
    const flags = {
      toxicity: result.toxicity,
      spam: result.spam,
      hate: result.hate,
      nsfw: result.nsfw,
      reasoning: result.reasoning,
    };

    if (data.postId) {
      await supabase
        .from("posts")
        .update({ is_hidden: shouldHide, ai_score: max, ai_flags: flags } as never)
        .eq("id", data.postId);
      if (shouldFlag) {
        const reasonKey = (["hate", "nsfw", "toxicity", "spam"] as const).find(
          (k) => (result![k] ?? 0) >= 0.5,
        );
        await supabase.from("reports").insert({
          reporter_id: context.userId,
          target_type: "post",
          target_id: data.postId,
          reason: `ai:${reasonKey}:${max.toFixed(2)} — ${result.reasoning}`.slice(0, 500),
        } as never);
      }
    } else if (data.commentId) {
      await supabase
        .from("comments")
        .update({ is_hidden: shouldHide, ai_score: max, ai_flags: flags } as never)
        .eq("id", data.commentId);
    }

    return { ok: true, hidden: shouldHide, flagged: shouldFlag, score: max, flags };
  });
