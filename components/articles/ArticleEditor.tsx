"use client";

// Block-based article editor with drag-to-reorder, "+ add block" UI,
// per-block field editors, and a live preview pane on wide screens.
//
// Wire-up: parent passes the initial blocks + onChange callback. The
// editor owns block state locally; saves are triggered by the parent
// page (which has the article meta — title/dek/cover/etc).
//
// Drag-and-drop uses the native HTML5 API. Each block is a draggable
// row; we track the dragged-block id in component state and reorder on
// drop. No third-party DnD lib needed.

import { useState } from "react";
import {
  BLOCK_TYPES,
  newBlock,
  type ArticleBlock,
  type BlockType,
} from "@/lib/article-blocks";
import { ArticleRenderer } from "@/components/articles/ArticleRenderer";

type Props = {
  blocks: ArticleBlock[];
  onChange: (next: ArticleBlock[]) => void;
};

const BLOCK_LABELS: Record<BlockType, { icon: string; label: string }> = {
  heading: { icon: "🅷", label: "Heading" },
  paragraph: { icon: "¶", label: "Paragraph" },
  image: { icon: "🖼️", label: "Image" },
  callout: { icon: "💡", label: "Callout" },
  quote: { icon: "❝", label: "Quote" },
  divider: { icon: "✦", label: "Divider" },
  button: { icon: "🔘", label: "Button" },
  list: { icon: "•", label: "List" },
};

export function ArticleEditor({ blocks, onChange }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);

  const updateBlock = (id: string, patch: Partial<ArticleBlock>) => {
    onChange(
      blocks.map((b) =>
        b.id === id ? ({ ...b, ...patch } as ArticleBlock) : b
      )
    );
  };
  const removeBlock = (id: string) => {
    onChange(blocks.filter((b) => b.id !== id));
  };
  const insertBlock = (type: BlockType, atIndex: number) => {
    const block = newBlock(type);
    const next = [...blocks];
    next.splice(atIndex, 0, block);
    onChange(next);
    setShowPicker(null);
  };
  const moveBlock = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const next = [...blocks];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    onChange(next);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card-sm bg-sky1 px-4 py-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="font-display text-sm uppercase tracking-wider text-navy">
            Editor · {blocks.length} block{blocks.length === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            onClick={() => setPreviewOpen((s) => !s)}
            className="font-display text-xs px-3 py-1 rounded-full border-2 border-navy bg-white text-navy"
          >
            {previewOpen ? "👀 Hide preview" : "👀 Show preview"}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {blocks.length === 0 ? (
            <div className="card-sm bg-white px-4 py-6 text-center">
              <p className="font-body text-sm text-navy-soft">
                Empty article. Click ✨ Add block below to start.
              </p>
            </div>
          ) : (
            blocks.map((block, i) => (
              <BlockRow
                key={block.id}
                block={block}
                index={i}
                isDragging={dragId === block.id}
                isOver={overId === block.id && dragId !== block.id}
                onDragStart={() => setDragId(block.id)}
                onDragOver={() => setOverId(block.id)}
                onDragEnd={() => {
                  if (dragId && overId && dragId !== overId) {
                    const fromIdx = blocks.findIndex((b) => b.id === dragId);
                    const toIdx = blocks.findIndex((b) => b.id === overId);
                    if (fromIdx >= 0 && toIdx >= 0) moveBlock(fromIdx, toIdx);
                  }
                  setDragId(null);
                  setOverId(null);
                }}
                onPatchData={(data) =>
                  updateBlock(block.id, { data } as Partial<ArticleBlock>)
                }
                onMoveUp={i > 0 ? () => moveBlock(i, i - 1) : undefined}
                onMoveDown={
                  i < blocks.length - 1 ? () => moveBlock(i, i + 1) : undefined
                }
                onRemove={() => removeBlock(block.id)}
                onInsertAfter={() => setShowPicker(i + 1)}
              />
            ))
          )}
        </div>

        {/* Always-visible "add block" at the end. Picker handles inline
            insert at any other index. */}
        <div className="mt-2">
          {showPicker != null ? (
            <BlockPicker
              onPick={(type) => insertBlock(type, showPicker)}
              onCancel={() => setShowPicker(null)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowPicker(blocks.length)}
              className="pop pop-coral text-base w-full justify-center"
            >
              ✨ Add block
            </button>
          )}
        </div>
      </div>

      {previewOpen ? (
        <div className="card px-5 py-5 max-h-[80vh] overflow-y-auto">
          <p className="font-display text-xs uppercase tracking-wider text-navy-soft mb-3">
            Live preview
          </p>
          {blocks.length === 0 ? (
            <p className="font-body text-sm text-navy-soft italic">
              Nothing to preview yet.
            </p>
          ) : (
            <ArticleRenderer blocks={blocks} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function BlockPicker({
  onPick,
  onCancel,
}: {
  onPick: (type: BlockType) => void;
  onCancel: () => void;
}) {
  return (
    <div className="card-sm bg-white border-3 border-navy px-3 py-3 flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-sm text-navy">Pick a block</p>
        <button
          type="button"
          onClick={onCancel}
          className="font-body text-xs text-navy-soft underline"
        >
          cancel
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {BLOCK_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onPick(t)}
            className="pop pop-white text-sm flex flex-col items-center gap-1 py-2"
          >
            <span className="text-2xl">{BLOCK_LABELS[t].icon}</span>
            <span>{BLOCK_LABELS[t].label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BlockRow({
  block,
  index,
  isDragging,
  isOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onPatchData,
  onMoveUp,
  onMoveDown,
  onRemove,
  onInsertAfter,
}: {
  block: ArticleBlock;
  index: number;
  isDragging: boolean;
  isOver: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
  onPatchData: (data: ArticleBlock["data"]) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove: () => void;
  onInsertAfter: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        // Set some text data so Firefox actually starts the drag.
        e.dataTransfer.setData("text/plain", block.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
      }}
      onDragEnd={onDragEnd}
      className={
        "card-sm bg-white px-3 py-3 flex gap-3 items-start " +
        (isDragging ? "opacity-50 " : "") +
        (isOver ? "ring-4 ring-coral " : "")
      }
    >
      <div className="flex flex-col items-center gap-1 shrink-0 cursor-grab select-none">
        <span
          aria-label="Drag handle"
          title="Drag to reorder"
          className="text-navy-soft text-xl"
        >
          ⋮⋮
        </span>
        <span className="font-display text-xs text-navy-soft">{index + 1}</span>
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display text-xs uppercase tracking-wider text-coral-deep">
            {BLOCK_LABELS[block.type].icon} {BLOCK_LABELS[block.type].label}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {onMoveUp ? (
              <button
                type="button"
                onClick={onMoveUp}
                className="font-display text-xs px-2 py-0.5 rounded border-2 border-navy bg-white"
                title="Move up"
              >
                ↑
              </button>
            ) : null}
            {onMoveDown ? (
              <button
                type="button"
                onClick={onMoveDown}
                className="font-display text-xs px-2 py-0.5 rounded border-2 border-navy bg-white"
                title="Move down"
              >
                ↓
              </button>
            ) : null}
            <button
              type="button"
              onClick={onInsertAfter}
              className="font-display text-xs px-2 py-0.5 rounded border-2 border-navy bg-sun text-navy"
              title="Insert block after this one"
            >
              + after
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="font-display text-xs px-2 py-0.5 rounded border-2 border-navy bg-coral text-white"
              title="Delete block"
            >
              ✕
            </button>
          </div>
        </div>
        <BlockEditFields block={block} onPatch={onPatchData} />
      </div>
    </div>
  );
}

// Per-type field editor. Each just renders the inputs for the block's
// `data` and routes patches up. Inline-markdown hint shown where it's
// supported (paragraph / callout / list items).
function BlockEditFields({
  block,
  onPatch,
}: {
  block: ArticleBlock;
  onPatch: (data: ArticleBlock["data"]) => void;
}) {
  switch (block.type) {
    case "heading":
      return (
        <div className="flex gap-2 items-stretch">
          <select
            value={block.data.level}
            onChange={(e) =>
              onPatch({ ...block.data, level: Number(e.target.value) as 2 | 3 })
            }
            className="card-sm bg-white px-2 py-1 border-2 border-navy text-sm font-body"
          >
            <option value={2}>H2 (big)</option>
            <option value={3}>H3 (small)</option>
          </select>
          <input
            value={block.data.text}
            onChange={(e) => onPatch({ ...block.data, text: e.target.value })}
            placeholder="Heading text"
            className="card-sm bg-white px-3 py-1.5 flex-1 font-body text-base border-2 border-navy"
            maxLength={160}
          />
        </div>
      );
    case "paragraph":
      return (
        <div>
          <textarea
            value={block.data.text}
            onChange={(e) => onPatch({ ...block.data, text: e.target.value })}
            placeholder="Write a paragraph. Supports **bold**, _italic_, `code`, [links](url)."
            rows={4}
            className="card-sm bg-white px-3 py-2 w-full font-body text-base border-2 border-navy"
            maxLength={4000}
          />
          <MarkdownHint />
        </div>
      );
    case "image":
      return (
        <div className="flex flex-col gap-2">
          <input
            value={block.data.src}
            onChange={(e) => onPatch({ ...block.data, src: e.target.value })}
            placeholder="Image URL (paste from /host/files)"
            className="card-sm bg-white px-3 py-1.5 font-body text-sm border-2 border-navy"
            maxLength={800}
          />
          {block.data.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.data.src}
              alt={block.data.alt || ""}
              className="max-w-full rounded-xl border-3 border-navy max-h-48 object-contain bg-white"
            />
          ) : null}
          <input
            value={block.data.alt}
            onChange={(e) => onPatch({ ...block.data, alt: e.target.value })}
            placeholder="Alt text (for screen readers)"
            className="card-sm bg-white px-3 py-1.5 font-body text-sm border-2 border-navy"
            maxLength={200}
          />
          <input
            value={block.data.caption ?? ""}
            onChange={(e) =>
              onPatch({ ...block.data, caption: e.target.value })
            }
            placeholder="Caption (optional)"
            className="card-sm bg-white px-3 py-1.5 font-body text-sm border-2 border-navy"
            maxLength={200}
          />
        </div>
      );
    case "callout":
      return (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 items-stretch flex-wrap">
            <select
              value={block.data.tone}
              onChange={(e) =>
                onPatch({
                  ...block.data,
                  tone: e.target.value as typeof block.data.tone,
                })
              }
              className="card-sm bg-white px-2 py-1 border-2 border-navy text-sm font-body"
            >
              <option value="sun">🟡 Sun</option>
              <option value="coral">🩷 Coral</option>
              <option value="sky">🔵 Sky</option>
              <option value="grass">🟢 Grass</option>
            </select>
            <input
              value={block.data.emoji ?? ""}
              onChange={(e) =>
                onPatch({ ...block.data, emoji: e.target.value })
              }
              placeholder="Emoji"
              className="card-sm bg-white px-3 py-1.5 w-20 text-center font-body text-base border-2 border-navy"
              maxLength={4}
            />
          </div>
          <textarea
            value={block.data.text}
            onChange={(e) => onPatch({ ...block.data, text: e.target.value })}
            placeholder="Callout text (markdown supported)"
            rows={3}
            className="card-sm bg-white px-3 py-2 font-body text-base border-2 border-navy"
            maxLength={2000}
          />
          <MarkdownHint />
        </div>
      );
    case "quote":
      return (
        <div className="flex flex-col gap-2">
          <textarea
            value={block.data.text}
            onChange={(e) => onPatch({ ...block.data, text: e.target.value })}
            placeholder="The quote itself"
            rows={2}
            className="card-sm bg-white px-3 py-2 font-body text-base border-2 border-navy"
            maxLength={1000}
          />
          <input
            value={block.data.attribution ?? ""}
            onChange={(e) =>
              onPatch({ ...block.data, attribution: e.target.value })
            }
            placeholder="Who said it (optional)"
            className="card-sm bg-white px-3 py-1.5 font-body text-sm border-2 border-navy"
            maxLength={200}
          />
        </div>
      );
    case "divider":
      return (
        <select
          value={block.data.variant}
          onChange={(e) =>
            onPatch({
              ...block.data,
              variant: e.target.value as typeof block.data.variant,
            })
          }
          className="card-sm bg-white px-2 py-1 border-2 border-navy text-sm font-body self-start"
        >
          <option value="stars">✦ Stars</option>
          <option value="sun">✿ Sun</option>
          <option value="wave">～ Wave</option>
        </select>
      );
    case "button":
      return (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 items-stretch flex-wrap">
            <input
              value={block.data.text}
              onChange={(e) =>
                onPatch({ ...block.data, text: e.target.value })
              }
              placeholder="Button label"
              className="card-sm bg-white px-3 py-1.5 flex-1 font-body text-sm border-2 border-navy"
              maxLength={80}
            />
            <select
              value={block.data.tone}
              onChange={(e) =>
                onPatch({
                  ...block.data,
                  tone: e.target.value as typeof block.data.tone,
                })
              }
              className="card-sm bg-white px-2 py-1 border-2 border-navy text-sm font-body"
            >
              <option value="coral">Coral</option>
              <option value="sun">Sun</option>
              <option value="sky">Sky</option>
              <option value="grass">Grass</option>
              <option value="white">White</option>
            </select>
          </div>
          <input
            value={block.data.href}
            onChange={(e) => onPatch({ ...block.data, href: e.target.value })}
            placeholder="https://… or /relative/path"
            className="card-sm bg-white px-3 py-1.5 font-body text-sm border-2 border-navy"
            maxLength={800}
          />
        </div>
      );
    case "list":
      return (
        <div className="flex flex-col gap-2">
          <label className="font-body text-xs text-navy-soft flex items-center gap-2">
            <input
              type="checkbox"
              checked={block.data.ordered}
              onChange={(e) =>
                onPatch({ ...block.data, ordered: e.target.checked })
              }
            />
            Numbered (1. 2. 3.) instead of bullets
          </label>
          {block.data.items.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={item}
                onChange={(e) => {
                  const items = [...block.data.items];
                  items[i] = e.target.value;
                  onPatch({ ...block.data, items });
                }}
                placeholder={`Item ${i + 1}`}
                className="card-sm bg-white px-3 py-1.5 flex-1 font-body text-sm border-2 border-navy"
                maxLength={400}
              />
              <button
                type="button"
                onClick={() => {
                  const items = block.data.items.filter((_, idx) => idx !== i);
                  onPatch({
                    ...block.data,
                    items: items.length > 0 ? items : [""],
                  });
                }}
                className="font-display text-xs px-2 py-1 rounded border-2 border-navy bg-coral text-white"
                title="Remove item"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onPatch({ ...block.data, items: [...block.data.items, ""] })
            }
            className="pop pop-white text-xs self-start"
          >
            + add item
          </button>
          <MarkdownHint />
        </div>
      );
  }
}

function MarkdownHint() {
  return (
    <p className="font-body text-xs text-navy-soft mt-1">
      Inline: <code>**bold**</code> · <code>_italic_</code> ·{" "}
      <code>`code`</code> · <code>[link](https://…)</code>
    </p>
  );
}
