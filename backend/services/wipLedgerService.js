import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GSS Financial Absorption Engine: 
 * Calculates exact labor and factory overhead burden costs upon a job clock-out,
 * then writes the corresponding debit lines straight into the WipLedger.
 */
export async function absorbManufacturingCosts(laborTransactionId) {
  try {
    // 1. Fetch the completed labor transaction and include its work center profile rates
    const punch = await prisma.laborTransaction.findUnique({
      where: { id: laborTransactionId },
      include: {
        jobRouting: {
          include: { workCenter: true }
        }
      }
    });

    if (!punch || !punch.jobRouting || !punch.jobRouting.workCenter) {
      console.log(`⏭️ Financial Absorption: Transaction ${laborTransactionId} missing explicit work center link. Skipping GL posting.`);
      return null;
    }

    const actualHours = Number(punch.actualHours || 0);
    if (actualHours <= 0) return null;

    const workCenter = punch.jobRouting.workCenter;
    
    // Extract standard GSS rates defensively depending on schema variations
    const laborRate = Number(workCenter.hourlyLaborRate || workCenter.laborRate || 0);
    const overheadRate = Number(workCenter.hourlyOverheadRate || workCenter.overheadRate || 0);

    // 2. Compute exact financial asset values absorbed by this floor transaction
    const absorbedLaborCost = actualHours * laborRate;
    const absorbedOverheadCost = actualHours * overheadRate;
    const totalAbsorbedValue = absorbedLaborCost + absorbedOverheadCost;

    console.log(`💰 GSS Financial Engine: Absorbing $${totalAbsorbedValue.toFixed(2)} ($${absorbedLaborCost.toFixed(2)} Labor / $${absorbedOverheadCost.toFixed(2)} Overhead) for Job transaction ${laborTransactionId}`);

    // 3. Open a secure transaction block to write the matching journal entries into the WipLedger
    const financialLog = await prisma.$transaction(async (tx) => {
      return await tx.wipLedger.create({
        data: {
          laborTransactionId: punch.id,
          workOrderId: punch.workOrderId,
          materialWip: 0.00,
          laborWip: parseFloat(absorbedLaborCost.toFixed(2)),
          overheadWip: parseFloat(absorbedOverheadCost.toFixed(2)),
          totalWipValue: parseFloat(totalAbsorbedValue.toFixed(2)),
          postedAt: new Date()
        }
      });
    });

    return financialLog;

  } catch (error) {
    console.error("❌ Failed to complete background WIP asset accounting absorption:", error.message);
    return null;
  }
}
