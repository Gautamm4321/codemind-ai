"use client";

import { ChevronDown, ChevronRight, File, Folder, FolderOpen, Search } from "lucide-react";
import { memo, useMemo, useState } from "react";
import type { TreeFile } from "@/types";

interface Node {
  name: string;
  path: string;
  children?: Map<string, Node>;
}

function buildTree(files: TreeFile[]): Node {
  const root: Node = { name: "", path: "", children: new Map() };
  for (const f of files) {
    const parts = f.path.split("/");
    let node = root;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");
      let next = node.children!.get(part);
      if (!next) {
        next = { name: part, path, children: isFile ? undefined : new Map() };
        node.children!.set(part, next);
      }
      node = next;
    });
  }
  return root;
}

function sortedChildren(node: Node): Node[] {
  return [...(node.children?.values() ?? [])].sort((a, b) => {
    const aDir = !!a.children;
    const bDir = !!b.children;
    if (aDir !== bDir) return aDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

interface Props {
  files: TreeFile[];
  selected: string | null;
  onSelect: (path: string) => void;
}

export default function FileTree({ files, selected, onSelect }: Props) {
  const root = useMemo(() => buildTree(files), [files]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  // Keep the folders of the selected file open (e.g. when opened from a citation).
  const [lastSelected, setLastSelected] = useState(selected);
  if (selected !== lastSelected) {
    setLastSelected(selected);
    if (selected) {
      const parts = selected.split("/");
      const next = new Set(open);
      for (let i = 1; i < parts.length; i++) next.add(parts.slice(0, i).join("/"));
      setOpen(next);
    }
  }

  const toggle = (path: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return files.filter((f) => f.path.toLowerCase().includes(q)).slice(0, 200);
  }, [files, query]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-navy p-3">
        <label className="flex items-center gap-2 rounded-full border border-navy px-3 py-1.5">
          <Search className="size-3.5 shrink-0" />
          <span className="sr-only">Filter files</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filter ${files.length} files`}
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-auto py-2 text-sm" role="tree" aria-label="Repository files">
        {matches ? (
          matches.length ? (
            matches.map((f) => (
              <button
                key={f.path}
                onClick={() => onSelect(f.path)}
                className={`flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-navy/10 ${
                  selected === f.path ? "bg-navy text-beige hover:bg-navy" : ""
                }`}
              >
                <File className="size-3.5 shrink-0" />
                <span className="truncate" title={f.path}>
                  {f.path}
                </span>
              </button>
            ))
          ) : (
            <p className="px-4 py-2">No matching files.</p>
          )
        ) : (
          sortedChildren(root).map((n) => (
            <TreeNode key={n.path} node={n} depth={0} open={open} toggle={toggle} selected={selected} onSelect={onSelect} />
          ))
        )}
      </div>
    </div>
  );
}

interface NodeProps {
  node: Node;
  depth: number;
  open: Set<string>;
  toggle: (p: string) => void;
  selected: string | null;
  onSelect: (p: string) => void;
}

const TreeNode = memo(function TreeNode({ node, depth, open, toggle, selected, onSelect }: NodeProps) {
  const pad = { paddingLeft: `${12 + depth * 14}px` };

  if (!node.children) {
    const active = selected === node.path;
    return (
      <button
        role="treeitem"
        aria-selected={active}
        onClick={() => onSelect(node.path)}
        style={pad}
        className={`flex w-full items-center gap-2 py-1 pr-3 text-left hover:bg-navy/10 ${active ? "bg-navy text-beige hover:bg-navy" : ""}`}
      >
        <File className="size-3.5 shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
    );
  }

  const isOpen = open.has(node.path);
  return (
    <div role="group">
      <button
        role="treeitem"
        aria-selected={false}
        aria-expanded={isOpen}
        onClick={() => toggle(node.path)}
        style={pad}
        className="flex w-full items-center gap-1.5 py-1 pr-3 text-left font-medium hover:bg-navy/10"
      >
        {isOpen ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
        {isOpen ? <FolderOpen className="size-3.5 shrink-0" /> : <Folder className="size-3.5 shrink-0" />}
        <span className="truncate">{node.name}</span>
      </button>
      {isOpen &&
        sortedChildren(node).map((c) => (
          <TreeNode key={c.path} node={c} depth={depth + 1} open={open} toggle={toggle} selected={selected} onSelect={onSelect} />
        ))}
    </div>
  );
});
