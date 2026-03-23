// path:  /apps/web/app/api/worker/push/route.ts
// description:  push notifications worker

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Job = {
  id: string;
  event_id: string;
  recipient_email: string;
  type: string;
  payload: any;
  device_token: string;
};

function getSupabaseAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase admin env");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

function renderNotification(job: Job) {
  const eventTitle = job.payload?.event_title || "your event";
  const hostName = job.payload?.host_name || "Someone";
  const guestName = job.payload?.guest_name || "Someone";

  const contentMap: Record<string, { title: string; body: string }> = {
    invite_created: {
      title: "Invitation",
      body: `${hostName} invited you to ${eventTitle}`,
    },
    event_cancelled: {
  title: "Event cancelled",
  body: job.payload?.message
    ? `Cancelled: ${eventTitle} — ${job.payload.message}`
    : `${hostName} cancelled ${eventTitle}`,
},
    chat_message_batch: {
      title: "New messages",
      body: `New messages in ${eventTitle}`,
    },
    event_updated: {
      title: "Event updated",
      body: `Details changed for ${eventTitle}`,
    },
        rsvp_received: {
      title: "New RSVP",
      body:
        job.payload?.response === "interested"
          ? `${guestName} is interested in ${eventTitle}`
          : job.payload?.response === "maybe"
          ? `${guestName} might come to ${eventTitle}`
          : job.payload?.response === "no"
          ? `${guestName} can't make it to  ${eventTitle}`
          : `${guestName} is coming to ${eventTitle}`,
    },
    join_request_created: {
      title: "Join request",
      body: `${guestName} wants to join ${eventTitle}`,
    },
    join_request_approved: {
      title: "You're in",
      body: `${hostName} approved your request for ${eventTitle}`,
    },
    join_request_denied: {
      title: "Request declined",
      body: `${hostName} declined your request for ${eventTitle}`,
    },
  };

  const key = job.type || job.payload?.type || job.payload?.template;

const content = contentMap[key] || {
    title: "Pallinky",
    body: "You have a new notification",
  };

return {
  to: job.device_token,
  sound: "default",
  channelId: "default",
  title: content.title,
  body: content.body,
 data: {
  event_id: job.event_id,
  type: job.type,
  message: job.payload?.message || null,
},
};
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");

  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET missing" }, { status: 500 });
  }

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.rpc("get_pending_push_notifications", {
    p_limit: 50,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const jobs = (data || []) as Job[];

  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const message = renderNotification(job);

      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });

      await getSupabaseAdmin().rpc("mark_push_sent", { p_id: job.id });

      sent++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    processed: jobs.length,
    sent,
    failed,
  });
}