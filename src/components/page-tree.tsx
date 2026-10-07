"use client";
import { useState } from "react";
import { ChevronRight, FileText } from "lucide-react";
import type { WikiPage } from "@/shared/types";
export function PageTree({ pages, selected, onSelect, onMove, canEdit }: { pages: WikiPage[]; selected: string | null; onSelect: (id: string) => void; onMove: (id: string, parentId: string | null, beforeId: string) => void; canEdit: boolean }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const render = (parent: string | null, depth = 0): React.ReactNode => pages.filter(p => p.parent_id === parent).map(page => {
    const hasChildren = pages.some(p => p.parent_id === page.id); const closed = collapsed.has(page.id);
    return <div key={page.id}><div className={`tree-item ${selected === page.id ? "active" : ""}`} style={{ paddingLeft: 8 + depth * 16 }} draggable={canEdit} onDragStart={e => { e.dataTransfer.setData("text/lattice-page", page.id); }} onDragOver={e => { if (canEdit) e.preventDefault(); }} onDrop={e => { e.preventDefault(); e.stopPropagation(); const id = e.dataTransfer.getData("text/lattice-page"); if (id && id !== page.id) onMove(id, page.parent_id, page.id); }}>
      {hasChildren ? <button className="tree-toggle" aria-label={`${closed ? "Expand" : "Collapse"} ${page.title}`} aria-expanded={!closed} onClick={() => setCollapsed(old => { const next = new Set(old); if (next.has(page.id)) next.delete(page.id); else next.add(page.id); return next; })}><ChevronRight size={12} style={{ transform: closed ? undefined : "rotate(90deg)" }} /></button> : <span className="tree-spacer" />}<button className="tree-link" onClick={() => onSelect(page.id)}><FileText size={15} /><span>{page.title}</span>{page.state === "draft" && <i className="draft-dot" title="Draft" />}</button>
    </div>{hasChildren && !closed && <div>{render(page.id,depth+1)}</div>}</div>;
  });
  return <nav aria-label="Page tree">{render(null)}</nav>;
}

