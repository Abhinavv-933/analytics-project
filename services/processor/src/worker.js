while (true) {
  try {
    // BRPOP blocks until an element is available
    const res = await redis.brPop(QUEUE_NAME, 0);
    if (!res) continue;

    const payload = res.element || res[1];
    if (!payload) continue;

    const event = JSON.parse(payload);

    console.log("\n========================================");
    console.log("📥 New Event Received");
    console.log(`🆔 Event ID   : ${event.id}`);
    console.log(`🌐 Site       : ${event.site_id}`);
    console.log(`📌 Type       : ${event.event_type}`);
    console.log(`📄 Path       : ${event.path || "/"}`);
    console.log(`👤 User       : ${event.user_id || "Anonymous"}`);
    console.log(`⏰ Timestamp  : ${event.timestamp}`);

    // Convert timestamp to YYYY-MM-DD
    const date = await isoDate(event.timestamp || new Date().toISOString());
    const pathKey = (event.path || "/").toString();

    // Store raw event
    await eventsCol.insertOne({
      event_id: event.id,
      site_id: event.site_id,
      event_type: event.event_type,
      path: event.path || "/",
      user_id: event.user_id || null,
      timestamp: event.timestamp,
      date
    });

    console.log("✅ Raw event stored in MongoDB");

    // Update analytics
    await statsCol.updateOne(
      { site_id: event.site_id, date },
      {
        $inc: {
          total_views: 1,
          [`paths.${pathKey}`]: 1
        }
      },
      { upsert: true }
    );

    console.log("📊 Analytics updated");

    // Unique users
    if (event.user_id) {
      try {
        await uniqueUsersCol.updateOne(
          {
            site_id: event.site_id,
            date,
            user_id: event.user_id
          },
          {
            $setOnInsert: {
              site_id: event.site_id,
              date,
              user_id: event.user_id,
              first_seen: new Date().toISOString()
            }
          },
          { upsert: true }
        );

        console.log("👤 Unique user recorded");
      } catch (err) {
        if (err.code !== 11000) {
          console.error("Unique user update failed:", err);
        }
      }
    }

    console.log("🎉 Event processed successfully");
    console.log("========================================\n");

  } catch (err) {
    console.error("❌ Processor loop error:", err);
    await new Promise((r) => setTimeout(r, 500));
  }
}