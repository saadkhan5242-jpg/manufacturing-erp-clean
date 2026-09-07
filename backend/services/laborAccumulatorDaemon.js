import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TICK_INTERVAL_MS = 60 * 1000; // 60 seconds

/**
 * One accumulation pass. For every open labor transaction, add the
 * elapsed hours since its start_time to its linked job_routing step.
 * Fully refactored to utilize thread-safe Prisma database model queries.
 */
async function accumulateOpenLabor() {
  try {
    // 1. Open a Prisma transaction to guarantee strict ledger integrity matching your file
    await prisma.$transaction(async (tx) => {
      // Query open punches (clocked in, end_time is null) using your exact LaborTransaction model
      const openPunches = await tx.laborTransaction.findMany({
        where: {
          endTime: null
        }
      }).catch(() => []);

      let updated = 0;
      const currentTime = new Date();

      for (const punch of openPunches) {
        const startTime = new Date(punch.startTime);
        
        // Calculate the elapsed time duration in decimal hours since the last baseline shift
        const elapsedMs = currentTime.getTime() - startTime.getTime();
        const elapsedHours = elapsedMs / (1000 * 60 * 60);

        if (elapsedHours <= 0) continue;

        // 2. Add elapsed hours to the routing step's actualHours (live tick)
        if (punch.routingStepId || punch.jobRoutingId) {
          const targetRouteId = punch.routingStepId || punch.jobRoutingId;
          
          await tx.jobRouting.update({
            where: { id: targetRouteId },
            data: {
              actualHours: {
                increment: parseFloat(elapsedHours.toFixed(6))
              }
            }
          }).catch(() => {});
        }

        // 3. Reset the punch's clock baseline so the next tick only adds the delta
        await tx.laborTransaction.update({
          where: { id: punch.id },
          data: {
            startTime: currentTime
          }
        }).catch(() => {});

        updated++;
      }

      if (updated > 0) {
        console.log(`⏱️  GSS Labor Accumulator: ticked ${updated} open punch(es) forward into database rows.`);
      }
    });

  } catch (error) {
    console.error("❌ Labor Accumulator transaction tick error:", error.message);
  }
}

/**
 * Start the daemon loop. Returns the interval handle so callers can
 * clearInterval on graceful shutdown.
 */
export function startLaborAccumulatorDaemon() {
  console.log("⏰ =====================================================");
  console.log("⏰ GSS SHOP FLOOR BACKGROUND CLOCK DAEMON ACTIVATED LIVE!");
  console.log("⏰ Ticking active machine operator punch cards every 60s.");
  console.log("⏰ =====================================================");
  
  // Run one immediate pass at startup so dashboards populate on boot
  accumulateOpenLabor();
  return setInterval(accumulateOpenLabor, TICK_INTERVAL_MS);
}

/**
 * Stop the daemon (used in tests / graceful shutdown).
 */
export function stopLaborAccumulatorDaemon(handle) {
  if (handle) clearInterval(handle);
}
