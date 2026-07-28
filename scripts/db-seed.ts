/**
 * Seed + reset utilities for Phase 2A cloud foundation.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=... npm run db:seed
 *
 *   npm run db:reset   (requires service role — truncates app tables)
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEMO_PASSWORD = "pickit-demo-123";

const DEMO_MOVIES = [
  {
    id: "27205",
    title: "Inception",
    year: 2010,
    runtime: 148,
    rating: 8.4,
    genres: ["Action", "Science Fiction"],
    overview: "A thief who steals corporate secrets through dream-sharing.",
    poster_url: "https://image.tmdb.org/t/p/w500/oYuK0YD5y0tG3xK8vqZf0X5qVqZ.jpg",
    media_type: "movie",
  },
  {
    id: "157336",
    title: "Interstellar",
    year: 2014,
    runtime: 169,
    rating: 8.4,
    genres: ["Adventure", "Drama", "Science Fiction"],
    overview: "A team of explorers travel through a wormhole in space.",
    poster_url: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    media_type: "movie",
  },
  {
    id: "496243",
    title: "Parasite",
    year: 2019,
    runtime: 132,
    rating: 8.5,
    genres: ["Comedy", "Thriller", "Drama"],
    overview: "Greed and class discrimination threaten a newly formed relationship.",
    poster_url: "https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
    media_type: "movie",
  },
];

async function ensureUser(email: string, displayName: string) {
  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 200 });
  const existing = listed?.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  );
  if (existing) return existing.id;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
      provider: "email",
      is_guest: false,
    },
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? `Failed to create ${email}`);
  }
  await admin.from("users").upsert({
    id: data.user.id,
    display_name: displayName,
    email,
    provider: "email",
    is_guest: false,
    color: "#e50914",
  });
  return data.user.id;
}

async function seed() {
  console.log("Seeding demo movies…");
  const { error: movieError } = await admin.from("movies").upsert(DEMO_MOVIES);
  if (movieError) throw movieError;

  console.log("Creating demo users…");
  const alexId = await ensureUser("alex@pickit.demo", "Alex");
  const jordanId = await ensureUser("jordan@pickit.demo", "Jordan");

  console.log("Creating demo Crew…");
  const { data: crewRow, error: crewError } = await admin
    .from("crews")
    .upsert(
      {
        id: "00000000-0000-4000-8000-0000000000c1",
        name: "Alex & Jordan",
        created_by: alexId,
        updated_by: alexId,
      },
      { onConflict: "id" },
    )
    .select("id")
    .single();
  if (crewError) throw crewError;
  const crewId = crewRow.id as string;

  await admin.from("crew_members").upsert(
    [
      {
        crew_id: crewId,
        user_id: alexId,
        role: "owner",
      },
      {
        crew_id: crewId,
        user_id: jordanId,
        role: "member",
      },
    ],
    { onConflict: "crew_id,user_id" },
  );

  const listId = "demo-date-night";
  console.log("Seeding demo list…");
  const { error: listError } = await admin.from("lists").upsert({
    id: listId,
    owner_id: alexId,
    crew_id: crewId,
    name: "Date Night",
    emoji: "💋",
    description: "Demo list for closed beta",
    created_by: alexId,
    updated_by: alexId,
  });
  if (listError) throw listError;

  console.log("Seeding recommendations…");
  for (const movie of DEMO_MOVIES) {
    const { error } = await admin.from("recommendations").upsert(
      {
        list_id: listId,
        movie_id: movie.id,
        source_type: "search",
        source_label: "Search",
        metadata: {},
        added_by_user_id: alexId,
        created_by: alexId,
        updated_by: alexId,
      },
      { onConflict: "list_id,movie_id" },
    );
    if (error) throw error;
  }

  console.log("Seeding ratings…");
  for (const movie of DEMO_MOVIES) {
    for (const userId of [alexId, jordanId]) {
      const { error } = await admin.from("ratings").upsert(
        {
          list_id: listId,
          movie_id: movie.id,
          user_id: userId,
          vote: "like",
          created_by: userId,
          updated_by: userId,
        },
        { onConflict: "list_id,movie_id,user_id" },
      );
      if (error) throw error;
    }
  }

  await admin.from("crew_activity").insert({
    crew_id: crewId,
    user_id: alexId,
    list_id: listId,
    type: "list-created",
    summary: "New list created: Date Night",
    occurred_at: new Date().toISOString(),
  });

  await admin.from("preferences").upsert({
    user_id: alexId,
    appearance: "dark",
    analytics_opt_in: true,
    developer_mode: true,
  });
  await admin.from("preferences").upsert({
    user_id: jordanId,
    appearance: "dark",
    analytics_opt_in: true,
    developer_mode: false,
  });

  console.log("Done.");
  console.log(`Crew ${crewId} · Alex ${alexId} · Jordan ${jordanId}`);
  console.log(`Passwords: ${DEMO_PASSWORD}`);
}

async function reset() {
  console.log("Resetting app tables…");
  const tables = [
    "notifications",
    "presence",
    "crew_activity",
    "crew_invitations",
    "crew_members",
    "crews",
    "data_migrations",
    "movie_nights",
    "ratings",
    "recommendations",
    "lists",
    "preferences",
    "recommendation_sources",
  ];
  for (const table of tables) {
    if (table === "preferences") {
      const { error: prefError } = await admin
        .from("preferences")
        .delete()
        .neq("user_id", "00000000-0000-0000-0000-000000000000");
      if (prefError) console.warn(prefError.message);
      continue;
    }
    if (table === "presence") {
      const { error } = await admin
        .from("presence")
        .delete()
        .neq("user_id", "00000000-0000-0000-0000-000000000000");
      if (error) console.warn(table, error.message);
      continue;
    }
    const { error } = await admin.from(table).delete().neq("id", "___never___");
    if (error) console.warn(table, error.message);
  }
  console.log("Reset complete (auth users retained).");
}

const command = process.argv[2] ?? "seed";
if (command === "reset") {
  void reset().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  void seed().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
