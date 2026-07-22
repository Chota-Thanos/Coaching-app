"use client";

import React, { useMemo, useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";

import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Quote,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Table as TableIcon,
  PlusSquare,
  MinusSquare,
  Merge,
  Split,
  Trash2,
  Heading2,
  Heading3,
  Heading4,
  Edit3,
  Code,
  Eye,
  Link2,
  Unlink,
  Wand2,
  Loader2,
  ChevronDown
} from "lucide-react";
import { authenticatedPost, useAuth } from "../auth/auth-context";

const REWORD_MODES: { value: string; label: string }[] = [
  { value: "exam_tone", label: "Exam tone" },
  { value: "concise", label: "Make concise" },
  { value: "expand", label: "Expand" },
  { value: "simplify", label: "Simplify" },
  { value: "grammar", label: "Fix grammar" }
];

const HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "#fef08a", class: "bg-[#fef08a]" },
  { name: "Green", value: "#bbf7d0", class: "bg-[#bbf7d0]" },
  { name: "Blue", value: "#bfdbfe", class: "bg-[#bfdbfe]" },
  { name: "Rose", value: "#fecdd3", class: "bg-[#fecdd3]" },
];

type RichTextMarkdownEditorProps = {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  minHeightClass?: string;
};

export function RichTextMarkdownEditor({
  value,
  onChange,
  placeholder = "Start writing here...",
  label = "",
  required = false,
  minHeightClass = "min-h-[300px]"
}: RichTextMarkdownEditorProps) {
  const [tab, setTab] = useState<"visual" | "html" | "preview">("visual");
  const { token } = useAuth();
  const [rewording, setRewording] = useState(false);
  const [rewordMenu, setRewordMenu] = useState(false);

  const extensions = useMemo(() => {
    const list = [
      StarterKit.configure({
        // We disable list configurations here if we want standard behaviour
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ];
    const unique: any[] = [];
    const names = new Set<string>();
    for (const ext of list) {
      if (!ext) continue;
      if (!names.has(ext.name)) {
        names.add(ext.name);
        unique.push(ext);
      }
    }
    return unique;
  }, []);

  const editor = useEditor({
    extensions,
    content: value || "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (html !== value) {
        onChange(html);
      }
    },
  });

  // Sync external changes
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const desired = value || "";
    if (desired !== current) {
      editor.commands.setContent(desired);
    }
  }, [editor, value]);

  const insertLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = prompt("Enter URL", previousUrl || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  };

  const rewordSelection = async (mode: string) => {
    setRewordMenu(false);
    if (!editor || !token) return;
    const { from, to, empty } = editor.state.selection;
    if (empty) {
      alert("Select the text you want to reword first.");
      return;
    }
    const selected = editor.state.doc.textBetween(from, to, "\n");
    if (!selected.trim()) return;
    setRewording(true);
    try {
      const res = await authenticatedPost<{ text: string }>(
        "/api/v1/current-affairs/admin/agent/reword",
        token,
        { text: selected, mode }
      );
      editor.chain().focus().deleteRange({ from, to }).insertContent(res.text).run();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Rewording failed.");
    } finally {
      setRewording(false);
    }
  };

  const insertTable = () => {
    if (!editor) return;
    const rows = parseInt(prompt("Enter number of rows:", "3") || "0");
    const cols = parseInt(prompt("Enter number of columns:", "3") || "0");
    if (rows > 0 && cols > 0) {
      editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    }
  };

  return (
    <div className="space-y-1.5 w-full">
      <div className="flex items-center justify-between">
        {label && (
          <span className="text-xs font-bold text-ink uppercase tracking-wide">
            {label} {required && <span className="text-rose-500">*</span>}
          </span>
        )}
        
        {/* Editor Tabs */}
        <div className="flex rounded-lg border border-line bg-paper/30 p-0.5 text-xs select-none">
          <button
            type="button"
            onClick={() => setTab("visual")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-bold transition-all ${
              tab === "visual" ? "bg-white text-civic shadow-xs" : "text-ink/65 hover:text-ink"
            }`}
          >
            <Edit3 className="h-3.5 w-3.5" />
            Visual Editor
          </button>
          <button
            type="button"
            onClick={() => setTab("html")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-bold transition-all ${
              tab === "html" ? "bg-white text-civic shadow-xs" : "text-ink/65 hover:text-ink"
            }`}
          >
            <Code className="h-3.5 w-3.5" />
            HTML Code
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-bold transition-all ${
              tab === "preview" ? "bg-white text-civic shadow-xs" : "text-ink/65 hover:text-ink"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-line overflow-hidden bg-white shadow-xs focus-within:border-civic focus-within:ring-2 focus-within:ring-civic/10 transition-all w-full flex flex-col">
        {/* Tiptap Toolbar (Visual only) */}
        {tab === "visual" && editor && (
          <div className="flex flex-wrap items-center gap-1 bg-paper/40 border-b border-line/60 px-2 py-1.5 select-none rte-toolbar">
            
            {/* Heading Level */}
            <select
              className="rte-select h-8 border border-line rounded-lg px-2 text-xs text-ink outline-none bg-white font-semibold cursor-pointer"
              value={
                editor.isActive("heading", { level: 2 }) ? "h2" :
                editor.isActive("heading", { level: 3 }) ? "h3" :
                editor.isActive("heading", { level: 4 }) ? "h4" : "p"
              }
              onChange={(e) => {
                const v = e.target.value;
                if (v === "p") editor.chain().focus().setParagraph().run();
                else if (v === "h2") editor.chain().focus().toggleHeading({ level: 2 }).run();
                else if (v === "h3") editor.chain().focus().toggleHeading({ level: 3 }).run();
                else if (v === "h4") editor.chain().focus().toggleHeading({ level: 4 }).run();
              }}
            >
              <option value="p">Paragraph</option>
              <option value="h2">Heading 2 (H2)</option>
              <option value="h3">Heading 3 (H3)</option>
              <option value="h4">Heading 4 (H4)</option>
            </select>

            <span className="rte-sep h-4 w-[1px] bg-line/80 mx-1" />

            {/* Inline styles */}
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded-md transition-all ${
                editor.isActive("bold") ? "bg-civic/10 text-civic font-bold" : "text-ink/70 hover:text-civic hover:bg-civic/5"
              }`}
              title="Bold"
            >
              <Bold className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded-md transition-all ${
                editor.isActive("italic") ? "bg-civic/10 text-civic" : "text-ink/70 hover:text-civic hover:bg-civic/5"
              }`}
              title="Italic"
            >
              <Italic className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`p-1.5 rounded-md transition-all ${
                editor.isActive("underline") ? "bg-civic/10 text-civic" : "text-ink/70 hover:text-civic hover:bg-civic/5"
              }`}
              title="Underline"
            >
              <UnderlineIcon className="h-4 w-4" />
            </button>

            <span className="rte-sep h-4 w-[1px] bg-line/80 mx-1" />

            {/* Blockquote */}
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={`p-1.5 rounded-md transition-all ${
                editor.isActive("blockquote") ? "bg-civic/10 text-civic" : "text-ink/70 hover:text-civic hover:bg-civic/5"
              }`}
              title="Blockquote"
            >
              <Quote className="h-4 w-4" />
            </button>

            {/* Lists */}
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-1.5 rounded-md transition-all ${
                editor.isActive("bulletList") ? "bg-civic/10 text-civic" : "text-ink/70 hover:text-civic hover:bg-civic/5"
              }`}
              title="Bullet List"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`p-1.5 rounded-md transition-all ${
                editor.isActive("orderedList") ? "bg-civic/10 text-civic" : "text-ink/70 hover:text-civic hover:bg-civic/5"
              }`}
              title="Ordered List"
            >
              <ListOrdered className="h-4 w-4" />
            </button>

            <span className="rte-sep h-4 w-[1px] bg-line/80 mx-1" />

            {/* Alignments */}
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
              className={`p-1.5 rounded-md transition-all ${
                editor.isActive({ textAlign: "left" }) ? "bg-civic/10 text-civic" : "text-ink/70 hover:text-civic hover:bg-civic/5"
              }`}
              title="Align Left"
            >
              <AlignLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign("center").run()}
              className={`p-1.5 rounded-md transition-all ${
                editor.isActive({ textAlign: "center" }) ? "bg-civic/10 text-civic" : "text-ink/70 hover:text-civic hover:bg-civic/5"
              }`}
              title="Align Center"
            >
              <AlignCenter className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
              className={`p-1.5 rounded-md transition-all ${
                editor.isActive({ textAlign: "right" }) ? "bg-civic/10 text-civic" : "text-ink/70 hover:text-civic hover:bg-civic/5"
              }`}
              title="Align Right"
            >
              <AlignRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign("justify").run()}
              className={`p-1.5 rounded-md transition-all ${
                editor.isActive({ textAlign: "justify" }) ? "bg-civic/10 text-civic" : "text-ink/70 hover:text-civic hover:bg-civic/5"
              }`}
              title="Justify"
            >
              <AlignJustify className="h-4 w-4" />
            </button>

            <span className="rte-sep h-4 w-[1px] bg-line/80 mx-1" />

            {/* Link & Unlink */}
            <button
              type="button"
              onClick={insertLink}
              className={`p-1.5 rounded-md transition-all ${
                editor.isActive("link") ? "bg-civic/10 text-civic" : "text-ink/70 hover:text-civic hover:bg-civic/5"
              }`}
              title="Link URL"
            >
              <Link2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().unsetLink().run()}
              className="p-1.5 text-ink/70 hover:text-civic hover:bg-civic/5 rounded-md disabled:opacity-40"
              disabled={!editor.isActive("link")}
              title="Unlink"
            >
              <Unlink className="h-4 w-4" />
            </button>

            <span className="rte-sep h-4 w-[1px] bg-line/80 mx-1" />

            {/* Colors picker */}
            <div className="flex items-center gap-1.5 pl-1" title="Text Color">
              <span className="text-[10px] font-bold text-ink/40 uppercase">Color</span>
              <input
                className="w-5 h-5 rounded border border-line cursor-pointer bg-transparent p-0"
                type="color"
                onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
              />
            </div>
            <div className="flex items-center gap-1.5 pl-1.5" title="Highlight Text">
              <span className="text-[10px] font-bold text-ink/40 uppercase mr-0.5">Highlight</span>
              <div className="flex items-center gap-1">
                {HIGHLIGHT_COLORS.map((col) => (
                  <button
                    key={col.value}
                    type="button"
                    onClick={() => editor.chain().focus().toggleHighlight({ color: col.value }).run()}
                    className={`w-3.5 h-3.5 rounded-full border border-line hover:scale-110 active:scale-95 transition-all ${col.class}`}
                    title={col.name}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().unsetHighlight().run()}
                  className="w-3.5 h-3.5 rounded-full border border-line bg-white hover:bg-rose-50 flex items-center justify-center text-[8px] font-bold text-rose-500 hover:scale-110 active:scale-95 transition-all"
                  title="Clear Highlight"
                >
                  ✕
                </button>
              </div>
            </div>

            <span className="rte-sep h-4 w-[1px] bg-line/80 mx-1" />

            {/* Table insert */}
            <button
              type="button"
              onClick={insertTable}
              className="p-1.5 text-ink/70 hover:text-civic hover:bg-civic/5 rounded-md transition-all"
              title="Insert Table"
            >
              <TableIcon className="h-4 w-4" />
            </button>

            <span className="rte-sep h-4 w-[1px] bg-line/80 mx-1" />

            {/* Reword with AI */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setRewordMenu((open) => !open)}
                disabled={rewording}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-bold text-violet-600 hover:bg-violet-50 transition-all disabled:opacity-50"
                title="Reword the selected text with AI"
              >
                {rewording ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Reword AI
                <ChevronDown className="h-3 w-3" />
              </button>
              {rewordMenu && (
                <div className="absolute left-0 top-full z-20 mt-1 w-40 rounded-lg border border-line bg-white py-1 shadow-lg">
                  {REWORD_MODES.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => void rewordSelection(m.value)}
                      className="block w-full px-3 py-1.5 text-left text-xs font-semibold text-ink/80 hover:bg-violet-50 hover:text-violet-700"
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Table specific contextual actions */}
            {editor.isActive("table") && (
              <>
                <span className="w-[1px] h-4 bg-line/80 mx-1" />
                <button
                  type="button"
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-all"
                  title="Add Row After"
                >
                  <PlusSquare className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteRow().run()}
                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-all"
                  title="Delete Row"
                >
                  <MinusSquare className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().mergeCells().run()}
                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                  title="Merge Cells"
                >
                  <Merge className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().splitCell().run()}
                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                  title="Split Cell"
                >
                  <Split className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-md transition-all"
                  title="Delete Table"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
            
            <button
              type="button"
              onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
              className="px-1.5 py-1 text-[10px] font-bold text-rose-500 hover:bg-rose-50 rounded transition-all ml-auto"
              title="Clear Formatting"
            >
              Clear Format
            </button>
          </div>
        )}

        {/* Edit / Code / Preview areas */}
        {tab === "visual" && (
          <div className="flex-1 w-full bg-white outline-none">
            <EditorContent
              editor={editor}
              className={`w-full p-4 font-normal text-sm text-ink outline-none resize-y overflow-y-auto article-body prose prose-civic max-w-none tiptap-prosemirror ${minHeightClass}`}
              style={{ minHeight: "250px" }}
            />
          </div>
        )}

        {tab === "html" && (
          <textarea
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full p-4 font-mono text-xs text-ink/90 outline-none resize-y bg-paper/20 border-0 ${minHeightClass}`}
            placeholder="Paste HTML here or edit source directly..."
            style={{ minHeight: "250px" }}
          />
        )}

        {tab === "preview" && (
          <div
            className={`w-full p-4 overflow-y-auto bg-paper/10 text-sm leading-relaxed article-body prose prose-civic max-w-none select-text ${minHeightClass}`}
            style={{ minHeight: "250px" }}
            dangerouslySetInnerHTML={{
              __html: value || `<p class="text-ink/40 italic">Nothing to preview yet...</p>`,
            }}
          />
        )}
      </div>
    </div>
  );
}
