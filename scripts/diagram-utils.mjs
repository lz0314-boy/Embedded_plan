function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapText(value, maxChars = 12) {
  const text = String(value).trim();
  if (!text) return [""];
  const result = [];
  for (let index = 0; index < text.length; index += maxChars) result.push(text.slice(index, index + maxChars));
  return result;
}

function textLines(lines, x, y, lineHeight = 18, className = "diagram-text", anchor = "middle") {
  return `<text x="${x}" y="${y}" class="${className}" text-anchor="${anchor}">${lines.map((line, index) => `<tspan x="${x}" dy="${index ? lineHeight : 0}">${escapeXml(line)}</tspan>`).join("")}</text>`;
}

function edgeText(label, x, y, anchor = "middle") {
  const lines = wrapText(label, 14);
  return textLines(lines, x, y - ((lines.length - 1) * 14) / 2, 14, "diagram-edge-label", anchor);
}

function nodeLine(id, label, shape = "rect") {
  return { id, label: label ?? id, shape };
}

function parseFlowchart(source) {
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const direction = /^flowchart\s+(LR|RL|TB|TD|BT)/i.exec(lines[0] ?? "")?.[1]?.toUpperCase() ?? "TD";
  const nodes = new Map();
  const edges = [];
  const ensureNode = (id, label = id, shape = "rect") => {
    if (!nodes.has(id)) nodes.set(id, nodeLine(id, label, shape));
    else if (label !== id) nodes.set(id, nodeLine(id, label, shape));
    return id;
  };
  const nodePattern = /([A-Za-z_][\w-]*)\s*(\[([^\]]+)\]|\{([^}]+)\})/g;
  for (const line of lines.slice(1)) {
    for (const match of line.matchAll(nodePattern)) ensureNode(match[1], match[3] ?? match[4], match[4] ? "diamond" : "rect");
    // A node declaration may be attached to the source (`A[label] --> B`) or
    // to the target (`A --> B[label]`). Ignore those shapes while extracting
    // the graph edge; the node pass above keeps their labels.
    const edge = /^([A-Za-z_][\w-]*)(?:\s*(?:\[[^\]]+\]|\{[^}]+\}))?\s*(?:--\s*([^\-\n]*?)\s*-->|-->|-\.->|==>)\s*([A-Za-z_][\w-]*)/.exec(line);
    if (edge) {
      ensureNode(edge[1]); ensureNode(edge[3]);
      edges.push({ from: edge[1], to: edge[3], label: edge[2]?.trim() ?? "" });
    }
  }
  return { direction, nodes: [...nodes.values()], edges };
}

function parseSequence(source) {
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const participants = [];
  const participantIds = new Set();
  const messages = [];
  for (const line of lines.slice(1)) {
    const participant = /^(?:participant|actor)\s+([A-Za-z_][\w-]*)(?:\s+as\s+(.+))?$/i.exec(line);
    if (participant && !participantIds.has(participant[1])) {
      participantIds.add(participant[1]); participants.push({ id: participant[1], label: participant[2] ?? participant[1] });
      continue;
    }
    const message = /^([A-Za-z_][\w-]*)\s*(-->>|->>|-->|-x|->)\s*([A-Za-z_][\w-]*)\s*:\s*(.+)$/.exec(line);
    if (message) {
      for (const id of [message[1], message[3]]) if (!participantIds.has(id)) { participantIds.add(id); participants.push({ id, label: id }); }
      messages.push({ from: message[1], to: message[3], label: message[4], dashed: message[2].startsWith("--") });
    }
  }
  return { participants, messages };
}

function parseState(source) {
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const nodes = new Map();
  const edges = [];
  const ensureNode = (id) => {
    const normalized = id === "[*]" ? "__start__" : id;
    if (!nodes.has(normalized)) nodes.set(normalized, nodeLine(normalized, normalized === "__start__" ? "开始/结束" : normalized, normalized === "__start__" ? "circle" : "rect"));
    return normalized;
  };
  for (const line of lines.slice(1)) {
    const arrow = line.indexOf("-->");
    if (arrow < 1) continue;
    const fromLabel = line.slice(0, arrow).trim();
    const right = line.slice(arrow + 3).trim();
    if (!fromLabel || !right) continue;
    const separator = right.indexOf(":");
    const toLabel = (separator < 0 ? right : right.slice(0, separator)).trim();
    const label = separator < 0 ? "" : right.slice(separator + 1).trim();
    if (!toLabel) continue;
    const from = ensureNode(fromLabel); const to = ensureNode(toLabel);
    edges.push({ from, to, label });
  }
  return { direction: "TD", nodes: [...nodes.values()], edges };
}

function levelsFor(nodes, edges) {
  // A longest-path relaxation keeps ordinary flowcharts compact, but it never
  // terminates for the cycles that are normal in state diagrams. Seed roots
  // (or the first declared node for a closed graph), then visit each node once.
  // Back edges are still drawn, only their target is placed at the already
  // assigned level instead of making the whole diagram grow forever.
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)?.push(edge.to);
  }
  const roots = nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0);
  const queue = (roots.length ? roots : nodes.slice(0, 1)).map((node) => node.id);
  const levels = new Map();
  for (const id of queue) levels.set(id, 0);
  while (queue.length) {
    const current = queue.shift();
    for (const next of outgoing.get(current) ?? []) {
      if (levels.has(next)) continue;
      levels.set(next, (levels.get(current) ?? 0) + 1);
      queue.push(next);
    }
  }
  // Disconnected nodes should remain visible instead of disappearing from the
  // layout. Put them after the deepest connected level.
  let nextLevel = Math.max(0, ...levels.values()) + 1;
  for (const node of nodes) if (!levels.has(node.id)) levels.set(node.id, nextLevel++);
  return levels;
}

function renderFlowLike(model, title) {
  const { nodes, edges } = model;
  if (!nodes.length) return "";
  const levels = levelsFor(nodes, edges);
  const groups = new Map();
  for (const node of nodes) {
    const level = levels.get(node.id) ?? 0;
    if (!groups.has(level)) groups.set(level, []);
    groups.get(level).push(node);
  }
  const horizontal = model.direction === "LR" || model.direction === "RL";
  const nodeWidth = 190; const nodeHeight = 68; const gapX = 46;
  // Give labels room to breathe in vertical state/flow diagrams. The compact
  // gap used by a horizontal flow is too small for labels such as
  // “scheduler selects”.
  const gapY = horizontal ? 30 : 54;
  const maxGroup = Math.max(...[...groups.values()].map((group) => group.length));
  const maxLevel = Math.max(...groups.keys());
  const width = horizontal ? 40 + (maxLevel + 1) * (nodeWidth + gapX) : 40 + maxGroup * (nodeWidth + gapX);
  const height = horizontal ? 40 + maxGroup * (nodeHeight + gapY) : 40 + (maxLevel + 1) * (nodeHeight + gapY);
  const positions = new Map();
  for (const [level, group] of groups) group.forEach((node, index) => {
    const x = horizontal ? 20 + level * (nodeWidth + gapX) : 20 + index * (nodeWidth + gapX);
    const y = horizontal ? 20 + index * (nodeHeight + gapY) : 20 + level * (nodeHeight + gapY);
    positions.set(node.id, { x, y, cx: x + nodeWidth / 2, cy: y + nodeHeight / 2 });
  });
  const markerId = `arrow-${Math.random().toString(36).slice(2)}`;
  const arrows = edges.map((edge) => {
    const from = positions.get(edge.from); const to = positions.get(edge.to); if (!from || !to) return "";
    const backwards = !horizontal && (levels.get(edge.to) ?? 0) <= (levels.get(edge.from) ?? 0);
    if (backwards) {
      const start = { x: from.x + nodeWidth, y: from.cy };
      const end = { x: to.x + nodeWidth, y: to.cy };
      const side = width - 12;
      const labelX = side - 4; const labelY = (start.y + end.y) / 2;
      return `<path d="M ${start.x} ${start.y} L ${side} ${start.y} L ${side} ${end.y} L ${end.x} ${end.y}" class="diagram-edge" marker-end="url(#${markerId})" />${edge.label ? edgeText(edge.label, labelX, labelY, "end") : ""}`;
    }
    const start = horizontal ? { x: from.x + nodeWidth, y: from.cy } : { x: from.cx, y: from.y + nodeHeight };
    const end = horizontal ? { x: to.x, y: to.cy } : { x: to.cx, y: to.y };
    const labelX = (start.x + end.x) / 2; const labelY = (start.y + end.y) / 2 - 8;
    return `<path d="M ${start.x} ${start.y} L ${end.x} ${end.y}" class="diagram-edge" marker-end="url(#${markerId})" />${edge.label ? edgeText(edge.label, labelX, labelY) : ""}`;
  }).join("");
  const shapes = nodes.map((node) => {
    const pos = positions.get(node.id); const lines = wrapText(node.label);
    const textY = pos.cy - ((lines.length - 1) * 18) / 2 + 6;
    if (node.shape === "diamond") {
      const points = `${pos.cx},${pos.y} ${pos.x + nodeWidth},${pos.cy} ${pos.cx},${pos.y + nodeHeight} ${pos.x},${pos.cy}`;
      return `<polygon points="${points}" class="diagram-node diagram-diamond" />${textLines(lines, pos.cx, textY)}`;
    }
    if (node.shape === "circle") return `<circle cx="${pos.cx}" cy="${pos.cy}" r="24" class="diagram-node diagram-circle" />${textLines(lines, pos.cx, textY)}`;
    return `<rect x="${pos.x}" y="${pos.y}" width="${nodeWidth}" height="${nodeHeight}" rx="12" class="diagram-node" />${textLines(lines, pos.cx, textY)}`;
  }).join("");
  const orientation = horizontal ? " diagram-horizontal" : " diagram-vertical";
  return `<svg class="diagram-svg${orientation}" role="img" aria-label="${escapeXml(title)}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><title>${escapeXml(title)}</title><defs><marker id="${markerId}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z" class="diagram-arrow" /></marker></defs>${arrows}${shapes}</svg>`;
}

function renderSequence(model, title) {
  const { participants, messages } = model;
  if (!participants.length) return "";
  const colWidth = 190; const width = Math.max(560, participants.length * colWidth + 30); const top = 72; const rowHeight = 58; const height = top + messages.length * rowHeight + 50;
  const xFor = new Map(participants.map((item, index) => [item.id, 30 + index * colWidth + colWidth / 2]));
  const markerId = `arrow-${Math.random().toString(36).slice(2)}`;
  const headers = participants.map((item) => { const x = xFor.get(item.id); return `<rect x="${x - 72}" y="16" width="144" height="42" rx="10" class="diagram-node" />${textLines(wrapText(item.label, 10), x, 35)}`; }).join("");
  const lifelines = participants.map((item) => { const x = xFor.get(item.id); return `<line x1="${x}" y1="58" x2="${x}" y2="${height - 18}" class="diagram-lifeline" />`; }).join("");
  const arrows = messages.map((message, index) => { const y = top + index * rowHeight; const from = xFor.get(message.from); const to = xFor.get(message.to); const direction = to >= from ? 1 : -1; const x1 = from + direction * 8; const x2 = to - direction * 8; return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="diagram-edge${message.dashed ? " diagram-edge-dashed" : ""}" marker-end="url(#${markerId})" />${edgeText(message.label, (x1 + x2) / 2, y - 8)}`; }).join("");
  return `<svg class="diagram-svg diagram-sequence" role="img" aria-label="${escapeXml(title)}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><title>${escapeXml(title)}</title><defs><marker id="${markerId}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z" class="diagram-arrow" /></marker></defs>${lifelines}${headers}${arrows}</svg>`;
}

export function mermaidToSvg(source, title = "流程图") {
  const normalized = source.trim();
  if (/^sequenceDiagram\b/i.test(normalized)) return renderSequence(parseSequence(normalized), title);
  if (/^stateDiagram(?:-v2)?\b/i.test(normalized)) return renderFlowLike(parseState(normalized), title);
  if (/^flowchart\b/i.test(normalized)) return renderFlowLike(parseFlowchart(normalized), title);
  return "";
}
