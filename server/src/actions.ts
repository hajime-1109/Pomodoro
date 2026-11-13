// Actions for the Pomodoro timer. The countdown itself runs on the
// client; the server only persists the completed-work-session count so
// it survives reloads and device switches.

import { defineAction, z, type ActionsModule } from "@hatch/space-sdk";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

// Must match the length of the QUOTES list in the client (App.tsx).
const QUOTE_COUNT = 30;

/** Today's calendar date in Japan time (JST, UTC+9), as YYYY-MM-DD. */
function todayInJST(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

const statsResponse = z.object({
  completedCount: z.number(),
  todayCount: z.number(),
  quoteIndex: z.number().nullable(),
});

export const Actions = {
  getStats: defineAction({
    description:
      "Returns how many work sessions the user has completed in total and today (Japan time).",
    request: z.object({}),
    response: statsResponse,
    async handler(ctx): Promise<z.infer<typeof statsResponse>> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.stats)
        .where(eq(schema.stats.id, 1));
      const row = rows[0];
      // A stored today count only counts while its date is still
      // today in JST; once the date has rolled over it reads as 0.
      const todayCount =
        row && row.todayDate === todayInJST() ? row.todayCount : 0;
      return {
        completedCount: row?.completedCount ?? 0,
        todayCount,
        quoteIndex: row?.quoteIndex ?? null,
      };
    },
  }),

  completeWorkSession: defineAction({
    description:
      "Records one finished 25-minute work session, picks a new random quote index, and returns the new total count, today's count, and quote index.",
    request: z.object({}),
    response: statsResponse,
    async handler(ctx): Promise<z.infer<typeof statsResponse>> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.stats)
        .where(eq(schema.stats.id, 1));
      const next = (rows[0]?.completedCount ?? 0) + 1;
      // Today's count (JST): continues from the stored value only
      // when the stored date is still today; a new day starts at 1.
      const today = todayInJST();
      const nextToday =
        rows[0] && rows[0].todayDate === today
          ? rows[0].todayCount + 1
          : 1;
      // Pick a new quote at random for this completion, never repeating
      // the one currently shown.
      const prevQuote = rows[0]?.quoteIndex ?? null;
      let quoteIndex = Math.floor(Math.random() * QUOTE_COUNT);
      if (prevQuote != null && quoteIndex === prevQuote) {
        quoteIndex = (quoteIndex + 1) % QUOTE_COUNT;
      }
      if (rows[0]) {
        await db
          .update(schema.stats)
          .set({
            completedCount: next,
            todayCount: nextToday,
            todayDate: today,
            quoteIndex,
          })
          .where(eq(schema.stats.id, 1));
      } else {
        await db.insert(schema.stats).values({
          id: 1,
          completedCount: next,
          todayCount: nextToday,
          todayDate: today,
          quoteIndex,
        });
      }
      ctx.invalidateQueries();
      return { completedCount: next, todayCount: nextToday, quoteIndex };
    },
  }),

  resetStats: defineAction({
    description:
      "Resets the completed work session count (total and today) back to zero.",
    request: z.object({}),
    response: statsResponse,
    async handler(ctx): Promise<z.infer<typeof statsResponse>> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.stats)
        .where(eq(schema.stats.id, 1));
      const today = todayInJST();
      if (rows[0]) {
        await db
          .update(schema.stats)
          .set({
            completedCount: 0,
            todayCount: 0,
            todayDate: today,
            quoteIndex: null,
          })
          .where(eq(schema.stats.id, 1));
      } else {
        await db.insert(schema.stats).values({
          id: 1,
          completedCount: 0,
          todayCount: 0,
          todayDate: today,
          quoteIndex: null,
        });
      }
      ctx.invalidateQueries();
      return { completedCount: 0, todayCount: 0, quoteIndex: null };
    },
  }),
} satisfies ActionsModule;
