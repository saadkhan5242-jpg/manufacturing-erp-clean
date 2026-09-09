const clients = new Set();

function writeEvent(res, eventName, payload) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function subscribeToShopFloorEvents(res) {
  clients.add(res);
  writeEvent(res, "connected", { connected: true, timestamp: new Date().toISOString() });
  return () => clients.delete(res);
}

export function broadcastShopFloorEvent(eventName, payload) {
  const event = { ...payload, timestamp: new Date().toISOString() };
  for (const client of clients) {
    writeEvent(client, eventName, event);
  }
}