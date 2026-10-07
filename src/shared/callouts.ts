import type { Element, Root, RootContent } from "hast";

export const calloutLabels = {
  note: "Note",
  tip: "Tip",
  important: "Important",
  warning: "Warning",
  caution: "Caution",
} as const;
export type CalloutKind = keyof typeof calloutLabels;

export function rehypeCallouts() {
  return (tree: Root) => {
    const visit = (node: Root | RootContent) => {
      if (node.type === "element" && node.tagName === "blockquote") {
        const paragraph = node.children.find(
          (child) => child.type !== "text" || child.value.trim(),
        );
        if (paragraph?.type === "element" && paragraph.tagName === "p") {
          const first = paragraph.children[0];
          const marker =
            first?.type === "text" &&
            /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\r?\n|$)/.exec(
              first.value,
            );
          if (marker && first.type === "text") {
            node.properties.dataCallout = marker[1].toLowerCase();
            first.value = first.value.slice(marker[0].length);
            if (!first.value) {
              paragraph.children.shift();
              const next = paragraph.children[0];
              if (next?.type === "element" && next.tagName === "br")
                paragraph.children.shift();
            }
            if (!paragraph.children.length)
              node.children = node.children.filter(
                (child) => child !== paragraph,
              );
          }
        }
      }
      if ("children" in node) node.children.forEach(visit);
    };
    visit(tree);
  };
}

export function calloutKind(node?: Element): CalloutKind | undefined {
  const kind = node?.properties.dataCallout;
  return typeof kind === "string" && Object.hasOwn(calloutLabels, kind)
    ? (kind as CalloutKind)
    : undefined;
}
