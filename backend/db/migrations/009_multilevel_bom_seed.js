// Migration 009: Multi-level BOM demo seed (parent assembly -> sub-assembly -> raw stock)
// Guarded — only populates when boms is empty, so production data is never disturbed.

export async function up(client) {
  const bomCount = await client.query("SELECT COUNT(*)::int AS n FROM boms");
  if (bomCount.rows[0].n > 0) {
    console.log("Migration 009: boms already populated, skipping seed");
    return;
  }

  // Parts: raw material masters (needed for bom_components.part_id links)
  await client.query(`
    INSERT INTO parts (part_number, description, unit, lot_tracked, serial_tracked, active)
    VALUES
      ('MAT-STEEL-01', 'A36 Steel Sheet (4x8)', 'sheet', FALSE, FALSE, TRUE),
      ('MAT-ALUM-05',  '6061-T6 Aluminum Bar',  'each',  FALSE, FALSE, TRUE),
      ('HW-BOLT-M8',   'M8 Hex Bolt',           'each',  FALSE, FALSE, TRUE)
    ON CONFLICT (part_number) DO NOTHING
  `);

  // Products: finished assembly, sub-assembly, and raw materials
  await client.query(`
    INSERT INTO products (sku, name, description, unit_price, active)
    VALUES
      ('BRACKET-ASSY',  'Bracket Assembly',        'Finished multi-level bracket assembly', 412.50, TRUE),
      ('SUB-WELD',      'Welded Sub-Assembly',     'Intermediate welded frame sub-assembly', 180.00, TRUE),
      ('MAT-STEEL-01',  'A36 Steel Sheet (4x8)',   'Raw structural steel sheet',              45.00, TRUE),
      ('MAT-ALUM-05',   '6061-T6 Aluminum Bar',    'Raw aluminum flat bar stock',             22.50, TRUE),
      ('HW-BOLT-M8',    'M8 Hex Bolt',             'Raw hardware fastener',                    0.35, TRUE)
    ON CONFLICT (sku) DO NOTHING
  `);

  // Top-level BOM: BRACKET-ASSY
  await client.query(`
    INSERT INTO boms (product_id, revision, status)
    SELECT id, 'A', 'active' FROM products WHERE sku = 'BRACKET-ASSY'
    ON CONFLICT (product_id, revision) DO NOTHING
  `);
  // Sub-assembly BOM: SUB-WELD
  await client.query(`
    INSERT INTO boms (product_id, revision, status)
    SELECT id, 'A', 'active' FROM products WHERE sku = 'SUB-WELD'
    ON CONFLICT (product_id, revision) DO NOTHING
  `);

  // BRACKET-ASSY components: 1x SUB-WELD (nested) + 2x MAT-ALUM-05 + 8x HW-BOLT-M8
  await client.query(`
    INSERT INTO bom_components (bom_id, part_id, component_product_id, quantity, scrap_percent, sequence)
    SELECT pb.id,
           p.id,
           NULL,
           c.qty, 0, c.seq
    FROM boms pb
    JOIN products pr ON pr.id = pb.product_id AND pr.sku = 'BRACKET-ASSY'
    JOIN (VALUES (2, 'MAT-ALUM-05', 20), (8, 'HW-BOLT-M8', 30)) AS c(qty, sku, seq) ON TRUE
    JOIN parts p ON p.part_number = c.sku
    ON CONFLICT DO NOTHING
  `);
  // Nested sub-assembly edge (component_product_id -> SUB-WELD product)
  await client.query(`
    INSERT INTO bom_components (bom_id, part_id, component_product_id, quantity, scrap_percent, sequence)
    SELECT pb.id, NULL, sp.id, 1, 0, 10
    FROM boms pb
    JOIN products pr ON pr.id = pb.product_id AND pr.sku = 'BRACKET-ASSY'
    JOIN products sp ON sp.sku = 'SUB-WELD'
    ON CONFLICT DO NOTHING
  `);

  // SUB-WELD components: 3x MAT-STEEL-01 + 1x MAT-ALUM-05
  await client.query(`
    INSERT INTO bom_components (bom_id, part_id, component_product_id, quantity, scrap_percent, sequence)
    SELECT sb.id, p.id, NULL, c.qty, 0, c.seq
    FROM boms sb
    JOIN products pr ON pr.id = sb.product_id AND pr.sku = 'SUB-WELD'
    JOIN (VALUES (3, 'MAT-STEEL-01', 10), (1, 'MAT-ALUM-05', 20)) AS c(qty, sku, seq) ON TRUE
    JOIN parts p ON p.part_number = c.sku
    ON CONFLICT DO NOTHING
  `);

  console.log("Migration 009: seeded multi-level BOM (BRACKET-ASSY -> SUB-WELD -> raw materials)");
}

export async function down(client) {
  await client.query(`DELETE FROM bom_components WHERE bom_id IN (SELECT id FROM boms WHERE revision = 'A')`);
  await client.query(`DELETE FROM boms WHERE revision = 'A'`);
  await client.query(`DELETE FROM products WHERE sku IN ('BRACKET-ASSY','SUB-WELD','MAT-STEEL-01','MAT-ALUM-05','HW-BOLT-M8')`);
  console.log("Migration 009: rolled back multi-level BOM seed");
}
