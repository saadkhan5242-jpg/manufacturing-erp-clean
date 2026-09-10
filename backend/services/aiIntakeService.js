import { createHash } from "node:crypto";
import { withTransaction, query } from "../db.js";
import { aiQuoteExtractionOutputSchema } from "../validators/schemas.js";
import { broadcastShopFloorEvent } from "./shopFloorEventBus.js";

const DEFAULT_ROUTER_DRAFT = [
  { sequenceNumber: 10, operationName: "Milling", workCenterCode: "CNC_MILL", estimatedSetupMinutes: 60, estimatedRunMinutes: 30, outsideProcess: false, finishSpecification: "", qaRequired: false },
  { sequenceNumber: 20, operationName: "Deburr", workCenterCode: "DEBURR", estimatedSetupMinutes: 10, estimatedRunMinutes: 8, outsideProcess: false, finishSpecification: "", qaRequired: false },
  { sequenceNumber: 30, operationName: "Inspection", workCenterCode: "QUALITY", estimatedSetupMinutes: 15, estimatedRunMinutes: 10, outsideProcess: false, finishSpecification: "AS9102 dimensional verification", qaRequired: true }
];

export const AI_QUOTE_EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["partNumber", "revisionNumber", "materialGrade", "materialVolume", "materialUnit", "estimatedSetupMinutes", "estimatedCycleMinutes", "secondaryFinishes", "estimatorNotes", "confidenceScore", "bomDraft", "routerDraft"],
  properties: {
    partNumber: { type: "string" },
    revisionNumber: { type: "string" },
    materialGrade: { type: "string" },
    materialVolume: { type: "number", minimum: 0 },
    materialUnit: { type: "string" },
    estimatedSetupMinutes: { type: "number", minimum: 0 },
    estimatedCycleMinutes: { type: "number", minimum: 0 },
    secondaryFinishes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["process", "specification", "notes"],
        properties: {
          process: { type: "string" },
          specification: { type: "string" },
          notes: { type: "string" }
        }
      }
    },
    estimatorNotes: { type: "string" },
    confidenceScore: { type: "number", minimum: 0, maximum: 100 },
    bomDraft: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["parentPartNumber", "componentPartNumber", "componentDescription", "materialGrade", "quantityPer", "unit", "sourceConfidence"],
        properties: {
          parentPartNumber: { type: "string" },
          componentPartNumber: { type: "string" },
          componentDescription: { type: "string" },
          materialGrade: { type: "string" },
          quantityPer: { type: "number", exclusiveMinimum: 0 },
          unit: { type: "string" },
          sourceConfidence: { type: "number", minimum: 0, maximum: 100 }
        }
      }
    },
    routerDraft: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sequenceNumber", "operationName", "workCenterCode", "estimatedSetupMinutes", "estimatedRunMinutes", "outsideProcess", "finishSpecification", "qaRequired"],
        properties: {
          sequenceNumber: { type: "integer", minimum: 1 },
          operationName: { type: "string" },
          workCenterCode: { type: "string" },
          estimatedSetupMinutes: { type: "number", minimum: 0 },
          estimatedRunMinutes: { type: "number", minimum: 0 },
          outsideProcess: { type: "boolean" },
          finishSpecification: { type: "string" },
          qaRequired: { type: "boolean" }
        }
      }
    }
  }
};

function currentUserId(req) {
  const id = Number(req.user?.sub || req.user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function sourceHash(rawText) {
  return createHash("sha256").update(rawText).digest("hex");
}

function proposalNumber() {
  return `AIQ-${Date.now()}`;
}

function providerConfig(input) {
  const provider = input.modelProvider || process.env.AI_MODEL_PROVIDER || (process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai");
  const model = input.modelName || process.env.AI_MODEL_NAME || (provider === "anthropic" ? "claude-3-5-sonnet-latest" : "gpt-4o-mini");
  const apiKey = provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error(`${provider.toUpperCase()} API key is not configured`);
    error.statusCode = 503;
    error.code = "AI_PROVIDER_UNCONFIGURED";
    error.publicMessage = "AI intake provider is not configured";
    error.retryable = false;
    throw error;
  }
  return { provider, model, apiKey };
}

function systemPrompt() {
  return [
    "You extract structured ERP quoting data from customer RFQ text.",
    "Return only valid JSON matching the provided schema.",
    "Do not invent customer commitments. Use empty strings or conservative estimates when uncertain.",
    "Always include draft routing steps for Milling, Deburr, and Inspection unless the text clearly requires a different process.",
    "Any output is a draft proposal requiring human QA approval before production release."
  ].join(" ");
}

function normalizeExtraction(parsed) {
  const routerDraft = parsed.routerDraft.length > 0 ? parsed.routerDraft : DEFAULT_ROUTER_DRAFT;
  const hasMilling = routerDraft.some((step) => /mill/i.test(step.operationName));
  const hasDeburr = routerDraft.some((step) => /deburr/i.test(step.operationName));
  const hasInspection = routerDraft.some((step) => /inspect|quality|qc/i.test(step.operationName));
  const baseline = [
    ...(hasMilling ? [] : [DEFAULT_ROUTER_DRAFT[0]]),
    ...(hasDeburr ? [] : [DEFAULT_ROUTER_DRAFT[1]]),
    ...(hasInspection ? [] : [DEFAULT_ROUTER_DRAFT[2]])
  ];
  return {
    ...parsed,
    bomDraft: parsed.bomDraft.map((item) => ({ ...item, parentPartNumber: item.parentPartNumber || parsed.partNumber })),
    routerDraft: [...routerDraft, ...baseline]
      .sort((left, right) => left.sequenceNumber - right.sequenceNumber)
      .map((step, index) => ({ ...step, sequenceNumber: (index + 1) * 10 }))
  };
}

async function callOpenAi({ apiKey, model, rawText }) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: rawText }
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "erp_quote_extraction", strict: true, schema: AI_QUOTE_EXTRACTION_JSON_SCHEMA }
      }
    })
  });

  if (!response.ok) throw new Error(`OpenAI intake failed (${response.status})`);
  const payload = await response.json();
  return JSON.parse(payload.choices?.[0]?.message?.content || "{}");
}

async function callAnthropic({ apiKey, model, rawText }) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      temperature: 0,
      system: systemPrompt(),
      messages: [{ role: "user", content: `Return JSON for this schema:\n${JSON.stringify(AI_QUOTE_EXTRACTION_JSON_SCHEMA)}\n\nRFQ TEXT:\n${rawText}` }]
    })
  });

  if (!response.ok) throw new Error(`Anthropic intake failed (${response.status})`);
  const payload = await response.json();
  const text = payload.content?.find((block) => block.type === "text")?.text || "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch ? jsonMatch[0] : text);
}

async function callLlm(input) {
  const config = providerConfig(input);
  const raw = config.provider === "anthropic"
    ? await callAnthropic({ ...config, rawText: input.rawText })
    : await callOpenAi({ ...config, rawText: input.rawText });
  const parsed = aiQuoteExtractionOutputSchema.parse(raw);
  return { config, extraction: normalizeExtraction(parsed), raw };
}

export async function createAiQuoteDraftProposal(input, req) {
  const { config, extraction, raw } = await callLlm(input);
  const number = proposalNumber();
  const hash = sourceHash(input.rawText);

  const proposal = await withTransaction(async (client) => {
    const inserted = (await client.query(
      `INSERT INTO ai_quote_intake_proposals
        (proposal_number, source_type, source_text_hash, customer_id, part_number, revision_number, material_grade,
         material_volume, material_unit, estimated_setup_minutes, estimated_cycle_minutes, secondary_finishes,
         estimator_notes, confidence_score, model_provider, model_name, raw_model_output, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, $16, $17::jsonb, $18)
       RETURNING id, proposal_number AS "proposalNumber", validation_status AS "validationStatus", requires_qa_approval AS "requiresQaApproval", part_number AS "partNumber", revision_number AS "revisionNumber", created_at AS "createdAt"`,
      [number, input.sourceType, hash, input.customerId || null, extraction.partNumber, extraction.revisionNumber, extraction.materialGrade, extraction.materialVolume, extraction.materialUnit, extraction.estimatedSetupMinutes, extraction.estimatedCycleMinutes, JSON.stringify(extraction.secondaryFinishes), extraction.estimatorNotes, extraction.confidenceScore || null, config.provider, config.model, JSON.stringify(raw), currentUserId(req)]
    )).rows[0];

    for (const item of extraction.bomDraft) {
      await client.query(
        `INSERT INTO ai_quote_intake_bom_drafts
          (proposal_id, parent_part_number, component_part_number, component_description, material_grade, quantity_per, unit, source_confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [inserted.id, item.parentPartNumber, item.componentPartNumber, item.componentDescription, item.materialGrade, item.quantityPer, item.unit, item.sourceConfidence || null]
      );
    }

    for (const step of extraction.routerDraft) {
      await client.query(
        `INSERT INTO ai_quote_intake_router_drafts
          (proposal_id, sequence_number, operation_name, work_center_code, estimated_setup_minutes, estimated_run_minutes, outside_process, finish_specification, qa_required)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [inserted.id, step.sequenceNumber, step.operationName, step.workCenterCode, step.estimatedSetupMinutes, step.estimatedRunMinutes, step.outsideProcess, step.finishSpecification, step.qaRequired]
      );
    }

    return inserted;
  });

  const result = { proposal, extraction, model: { provider: config.provider, name: config.model }, status: "Draft Proposal", requiresQaApproval: true };
  broadcastShopFloorEvent("ai-quote-proposal", result);
  return result;
}

export async function listAiQuoteDraftProposals() {
  const result = await query(
    `SELECT id, proposal_number AS "proposalNumber", customer_id AS "customerId", part_number AS "partNumber",
            revision_number AS "revisionNumber", material_grade AS "materialGrade", validation_status AS "validationStatus",
            requires_qa_approval AS "requiresQaApproval", confidence_score AS "confidenceScore", created_at AS "createdAt"
     FROM ai_quote_intake_proposals
     ORDER BY created_at DESC
     LIMIT 100`
  );
  return result.rows;
}

export async function reviewAiQuoteDraftProposal(id, review, req) {
  const status = review.approved ? "qa_approved" : "qa_rejected";
  const result = await query(
    `UPDATE ai_quote_intake_proposals
     SET validation_status = $1, requires_qa_approval = FALSE, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3, updated_at = NOW()
     WHERE id = $4
     RETURNING id, proposal_number AS "proposalNumber", validation_status AS "validationStatus", requires_qa_approval AS "requiresQaApproval", review_notes AS "reviewNotes"`,
    [status, currentUserId(req), review.reviewNotes, id]
  );
  return result.rows[0];
}
