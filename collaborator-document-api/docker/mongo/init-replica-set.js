/**
 * Initializes a single-node MongoDB replica set named `rs0`.
 *
 * Used as a reference script and for manual bootstrap. Docker Compose
 * embeds the same logic inline to avoid bind-mount permission issues.
 */
try {
  const status = rs.status();
  if (status.ok === 1) {
    print("Replica set already initialized");
  }
} catch (error) {
  print("Initializing replica set rs0...");
  rs.initiate({
    _id: "rs0",
    members: [{_id: 0, host: "localhost:27017"}]
  });

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const current = rs.status();
    if (current.ok === 1 && current.members?.[0]?.stateStr === "PRIMARY") {
      print("Replica set rs0 is PRIMARY");
      break;
    }
    sleep(1000);
  }
}
