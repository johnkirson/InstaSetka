import type { SlideElement } from "../../lib/types";
import { googleFontOptions } from "./fontOptions";

export type CarouselSlideTemplate = {
  id: string;
  name: string;
  description: string;
  elements: SlideElement[];
};

const baseFont = googleFontOptions[0].stack;
const accentFont = googleFontOptions[7].stack;
const serifFont = googleFontOptions[9].stack;

export const carouselSlideTemplates: CarouselSlideTemplate[] = [
  {
    id: "cover",
    name: "Cover",
    description: "Big title with a compact supporting line.",
    elements: [
      {
        id: "template-cover-kicker",
        type: "text",
        x: 0.12,
        y: 0.14,
        width: 0.5,
        height: 0.08,
        content: "01 / GUIDE",
        style: {
          fontFamily: baseFont,
          fontSize: 22,
          fontWeight: 700,
          color: "#e7ece5",
          textAlign: "left",
          lineHeight: 1,
        },
      },
      {
        id: "template-cover-title",
        type: "text",
        x: 0.12,
        y: 0.5,
        width: 0.76,
        height: 0.24,
        content: "Launch checklist",
        style: {
          fontFamily: baseFont,
          fontSize: 56,
          fontWeight: 800,
          color: "#ffffff",
          textAlign: "left",
          lineHeight: 0.96,
        },
      },
      {
        id: "template-cover-caption",
        type: "text",
        x: 0.12,
        y: 0.78,
        width: 0.68,
        height: 0.1,
        content: "A focused carousel for practical steps and examples.",
        style: {
          fontFamily: baseFont,
          fontSize: 24,
          fontWeight: 600,
          color: "#d7ded3",
          textAlign: "left",
          lineHeight: 1.12,
        },
      },
    ],
  },
  {
    id: "checklist",
    name: "Checklist",
    description: "Stacked action list for educational posts.",
    elements: [
      {
        id: "template-checklist-title",
        type: "text",
        x: 0.1,
        y: 0.12,
        width: 0.8,
        height: 0.12,
        content: "Before you publish",
        style: {
          fontFamily: accentFont,
          fontSize: 44,
          fontWeight: 800,
          color: "#ffffff",
          textAlign: "left",
          lineHeight: 1,
        },
      },
      {
        id: "template-checklist-items",
        type: "text",
        x: 0.12,
        y: 0.35,
        width: 0.76,
        height: 0.36,
        content: "1. Define the promise\n2. Keep one idea per slide\n3. Check the export preview",
        style: {
          fontFamily: baseFont,
          fontSize: 30,
          fontWeight: 700,
          color: "#f4f7f1",
          textAlign: "left",
          lineHeight: 1.28,
        },
      },
      {
        id: "template-checklist-footer",
        type: "text",
        x: 0.12,
        y: 0.82,
        width: 0.62,
        height: 0.08,
        content: "Save this for the next carousel",
        style: {
          fontFamily: baseFont,
          fontSize: 22,
          fontWeight: 600,
          color: "#d7ded3",
          textAlign: "left",
          lineHeight: 1,
        },
      },
    ],
  },
  {
    id: "quote",
    name: "Quote",
    description: "Centered quote with author or context line.",
    elements: [
      {
        id: "template-quote-mark",
        type: "text",
        x: 0.12,
        y: 0.18,
        width: 0.76,
        height: 0.1,
        content: "\"",
        style: {
          fontFamily: serifFont,
          fontSize: 74,
          fontWeight: 800,
          color: "#e7ece5",
          textAlign: "center",
          lineHeight: 0.8,
        },
      },
      {
        id: "template-quote-body",
        type: "text",
        x: 0.12,
        y: 0.34,
        width: 0.76,
        height: 0.28,
        content: "Strong carousels are built slide by slide, not decoration by decoration.",
        style: {
          fontFamily: serifFont,
          fontSize: 36,
          fontWeight: 800,
          color: "#ffffff",
          textAlign: "center",
          lineHeight: 1.08,
        },
      },
      {
        id: "template-quote-source",
        type: "text",
        x: 0.22,
        y: 0.72,
        width: 0.56,
        height: 0.08,
        content: "InstaSetka note",
        style: {
          fontFamily: baseFont,
          fontSize: 22,
          fontWeight: 600,
          color: "#d7ded3",
          textAlign: "center",
          lineHeight: 1,
        },
      },
    ],
  },
];
