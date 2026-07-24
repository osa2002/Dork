import { TraceSpan } from "./TraceSpan";

export interface SpanTreeNode {
  readonly span: TraceSpan;
  readonly children: readonly SpanTreeNode[];
}

export class SpanTreeBuilder {
  /**
   * Reconstructs parent-child execution hierarchies from a list of spans.
   */
  public static buildTree(spans: readonly TraceSpan[]): readonly SpanTreeNode[] {
    const nodesMap = new Map<string, { span: TraceSpan; children: any[] }>();

    // Initial pass: Create mutable tree nodes inside the map
    spans.forEach((span) => {
      nodesMap.set(span.spanId, {
        span,
        children: [],
      });
    });

    const roots: any[] = [];

    // Second pass: Associate children with parents
    spans.forEach((span) => {
      const currentNode = nodesMap.get(span.spanId)!;
      if (span.parentSpanId && nodesMap.has(span.parentSpanId)) {
        const parentNode = nodesMap.get(span.parentSpanId)!;
        parentNode.children.push(currentNode);
      } else {
        roots.push(currentNode);
      }
    });

    // Deep freeze nodes to ensure complete immutability
    const freezeNode = (node: any): SpanTreeNode => {
      const frozenNode: SpanTreeNode = {
        span: node.span,
        children: Object.freeze(node.children.map(freezeNode)),
      };
      return Object.freeze(frozenNode);
    };

    return Object.freeze(roots.map(freezeNode));
  }
}
