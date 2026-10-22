/**
 * Migrate Local MongoDB → MongoDB Atlas
 *
 * Usage:
 *   node scripts/migrateToAtlas.js "mongodb+srv://user:pass@cluster.mongodb.net/fairconnect?retryWrites=true&w=majority"
 *
 * This script:
 *   1. Connects to your LOCAL MongoDB (localhost:27017/fairconnect)
 *   2. Connects to your ATLAS cluster (the URI you pass as argument)
 *   3. Copies every collection (with all documents) from local → Atlas
 *   4. Preserves _id values so references between documents stay intact
 */

const { MongoClient } = require("mongodb");

const LOCAL_URI = "mongodb://localhost:27017/fairconnect";

async function migrate() {
  const atlasUri = process.argv[2];

  if (!atlasUri) {
    console.error(
      "\n❌  Please provide your Atlas connection string as an argument:"
    );
    console.error(
      '   node scripts/migrateToAtlas.js "mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/fairconnect"\n'
    );
    process.exit(1);
  }

  let localClient, atlasClient;

  try {
    // ── Connect to both databases ──────────────────────────────
    console.log("🔌 Connecting to LOCAL MongoDB...");
    localClient = new MongoClient(LOCAL_URI);
    await localClient.connect();
    const localDb = localClient.db("fairconnect");

    console.log("☁️  Connecting to MongoDB Atlas...");
    atlasClient = new MongoClient(atlasUri);
    await atlasClient.connect();
    const atlasDb = atlasClient.db("fairconnect");

    // ── Get all collections ────────────────────────────────────
    const collections = await localDb.listCollections().toArray();
    console.log(
      `\n📦 Found ${collections.length} collection(s): ${collections.map((c) => c.name).join(", ")}\n`
    );

    // ── Copy each collection ───────────────────────────────────
    let totalDocs = 0;

    for (const collInfo of collections) {
      const name = collInfo.name;
      const localColl = localDb.collection(name);
      const atlasColl = atlasDb.collection(name);

      const docs = await localColl.find({}).toArray();

      if (docs.length === 0) {
        console.log(`   ⏭️  ${name}: 0 documents (skipped)`);
        continue;
      }

      // Use ordered:false so it skips duplicates if you run this twice
      try {
        const result = await atlasColl.insertMany(docs, { ordered: false });
        console.log(`   ✅ ${name}: ${result.insertedCount} documents copied`);
        totalDocs += result.insertedCount;
      } catch (err) {
        if (err.code === 11000) {
          // Duplicate key — some docs already exist
          const inserted = err.result?.insertedCount || 0;
          console.log(
            `   ⚠️  ${name}: ${inserted} new documents copied (${docs.length - inserted} already existed)`
          );
          totalDocs += inserted;
        } else {
          throw err;
        }
      }
    }

    console.log(`\n🎉 Migration complete! ${totalDocs} total documents copied to Atlas.\n`);
    console.log("👉 Next steps:");
    console.log("   1. Update your .env MONGO_URI to the Atlas connection string");
    console.log("   2. Give the same MONGO_URI to your colleague");
    console.log("   3. Restart your server with: npm run dev\n");
  } catch (err) {
    console.error("\n❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    if (localClient) await localClient.close();
    if (atlasClient) await atlasClient.close();
  }
}

migrate();
