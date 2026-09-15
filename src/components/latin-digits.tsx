"use client";

import { useEffect } from "react";

const DIGIT_MAP: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

const LATIN_DIGITS = /[٠-٩۰-۹]/;

function normalizeDigits(value: string) {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => DIGIT_MAP[digit] ?? digit);
}

function normalizeTextNode(node: Text) {
  const value = node.nodeValue ?? "";
  if (!LATIN_DIGITS.test(value)) return;
  const normalized = normalizeDigits(value);
  if (normalized !== value) node.nodeValue = normalized;
}

function normalizeAttributes(element: Element) {
  for (const attribute of ["aria-label", "title", "placeholder"]) {
    const value = element.getAttribute(attribute);
    if (!value || !LATIN_DIGITS.test(value)) continue;
    const normalized = normalizeDigits(value);
    if (normalized !== value) element.setAttribute(attribute, normalized);
  }
}

function normalizeAddedNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    normalizeTextNode(node as Text);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const element = node as Element;
  normalizeAttributes(element);
  element.querySelectorAll("[aria-label], [title], [placeholder]").forEach(normalizeAttributes);

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let current: Node | null = walker.nextNode();
  while (current) {
    normalizeTextNode(current as Text);
    current = walker.nextNode();
  }
}

export function LatinDigits() {
  useEffect(() => {
    const initialWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let current: Node | null = initialWalker.nextNode();
    while (current) {
      normalizeTextNode(current as Text);
      current = initialWalker.nextNode();
    }

    document.body.querySelectorAll("[aria-label], [title], [placeholder]").forEach(normalizeAttributes);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          normalizeTextNode(mutation.target as Text);
        } else if (mutation.type === "childList") {
          mutation.addedNodes.forEach(normalizeAddedNode);
        } else if (mutation.type === "attributes") {
          normalizeAttributes(mutation.target as Element);
        }
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-label", "title", "placeholder"],
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
