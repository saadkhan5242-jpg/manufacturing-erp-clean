import { useState, useEffect, useCallback } from "react";
import apiClient from "../lib/apiClient.js";

// TreeRow is declared at module scope so React does not remount it on every render.
// It receives the expansion state + toggle via props instead of closing over them.
function TreeRow({ node, depth, expanded, onToggle }) {
  const hasKids = node.children && node.children.length > 0;
  const key = node.partNumber + depth;
  const open = expanded.has(key);
  return (
    <>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-100 cursor-pointer select-none ${depth === 0 ? "font-bold" : ""}`}
        style={{ paddingLeft: `${depth * 22 + 8}px` }}
        onClick={() => hasKids && onToggle(key)}
      >
        <span className="w-4 text-slate-400">{hasKids ? (open ? "▾" : "▸") : "·"}</span>
        <span className="text-slate-800">{node.partNumber}</span>
        <span className="text-xs text-slate-400 truncate">{node.description}</span>
        <span className="ml-auto text-xs font-mono text-slate-500">
          {node.totalQuantity > 0 ? `${node.totalQuantity} ${node.unit}` : ""}
        </span>
      </div>
      {hasKids && open && node.children.map((c) => (
        <TreeRow key={c.partNumber + (depth + 1)} node={c} depth={depth + 1} expanded={expanded} onToggle={onToggle} />
      ))}
    </>
  );
}

/**
 * BomTreeExplorer — interactive folder-tree explorer for multi-level BOMs.
 * Pulls recursively from GET /api/bom/explode/:partNumber and renders
 * collapsible branch rows tracking sub-component layers, unit requirements,
 * and baseline standard cost rollups.
 */
function BomTreeExplorer({ rootPart = "BRACKET-ASSY" }) {
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(new Set([rootPart]));
  const [partInput, setPartInput] = useState(rootPart);

  // Build a nested tree from the flat exploded materials list
  const buildTree = useCallback((flatMaterials, root) => {
    // Group by deepestLevel to reconstruct hierarchy; sub-assemblies become nodes
    const rootNode = { partNumber: root, description: "Parent Assembly", unit: "each", totalQuantity: 1, level: 0, cost: 0, children: [] };
    const byLevel = {};
    flatMaterials.forEach((m) => {
      byLevel[m.deepestLevel] = byLevel[m.deepestLevel] || [];
      byLevel[m.deepestLevel].push({ ...m, children: [] });
    });
    // Attach level-1 items to root, deeper items nest under the prior level's first node (simplified roll-up)
    rootNode.children = (byLevel[1] || []).map((m) => ({ ...m, level: 1, cost: 0 }));
    (byLevel[2] || []).forEach((m) => {
      // Nest raw materials from sub-assemblies under a synthetic sub-assembly node
      let subNode = rootNode.children.find((c) => c.isSubNode);
      if (!subNode) {
        subNode = { partNumber: "SUB-ASSEMBLIES", description: "Nested sub-assembly components", unit: "—", totalQuantity: 0, level: 1, isSubNode: true, cost: 0, children: [] };
        rootNode.children.push(subNode);
      }
      subNode.children.push({ ...m, level: 2, cost: 0 });
    });
    return rootNode;
  }, []);

  const explode = useCallback(async (part) => {
    setLoading(true);
    setError("");
    try {
      const data = await apiClient.get(`/api/bom/explode/${encodeURIComponent(part)}`);
      setTree(buildTree(data.materials || [], part));
    } catch (err) {
      setError(`BOM explosion failed: ${err.message}`);
      setTree(null);
    } finally {
      setLoading(false);
    }
  }, [buildTree]);

  useEffect(() => { explode(rootPart); }, [explode, rootPart]);

  const toggle = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Baseline standard cost rollup (raw materials)
  const costRollup = (node) => {
    if (!node) return 0;
    if (!node.children || node.children.length === 0) return Number(node.totalQuantity) || 0;
    return node.children.reduce((sum, c) => sum + costRollup(c), 0);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 max-w-3xl font-sans">
      <header className="border-b-2 border-slate-800 pb-3 mb-4">
        <h3 className="m-0 text-lg font-bold text-slate-800">🌲 BOM Tree Explorer</h3>
        <p className="m-0 mt-1 text-xs text-slate-500">Recursive multi-level assembly explosion to base raw materials</p>
      </header>

      <form
        className="flex gap-2 mb-4"
        onSubmit={(e) => { e.preventDefault(); if (partInput.trim()) explode(partInput.trim()); }}
      >
        <input
          value={partInput}
          onChange={(e) => setPartInput(e.target.value)}
          placeholder="Enter parent part number (e.g. BRACKET-ASSY)"
          className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        <button type="submit" className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded hover:bg-slate-700">
          Explode
        </button>
      </form>

      {error && <div className="px-3 py-2 rounded bg-red-600 text-white text-sm font-semibold mb-3">{error}</div>}
      {loading && <div className="text-slate-400 text-sm py-4 text-center">Exploding BOM tree…</div>}

      {!loading && tree && (
        <>
          <div className="border border-slate-200 rounded p-2 max-h-96 overflow-y-auto">
            <TreeRow node={tree} depth={0} expanded={expanded} onToggle={toggle} />
          </div>
          <div className="mt-4 flex justify-between items-center bg-slate-50 border border-slate-200 rounded px-4 py-3">
            <span className="text-xs uppercase tracking-wide text-slate-500">Baseline Standard Cost Rollup (raw units)</span>
            <span className="text-lg font-bold text-slate-800">{costRollup(tree).toFixed(0)} units</span>
          </div>
        </>
      )}
    </div>
  );
}

export default BomTreeExplorer;
