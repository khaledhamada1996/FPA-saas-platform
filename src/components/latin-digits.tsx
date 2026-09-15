"use client";

import { useEffect } from "react";

const DIGIT_MAP: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
};

const LATIN_DIGITS = /[٠-٩۰-۹]/g;

function normalizeDigits(value: string) {
  return value.replace(LATIN_DIGITS, (digit) => DIGIT_MAP[digit] ?? digit);
}

function normalizeElement(element: Element) {
  const attributes = ["aria-label", "title", "placeholder"];
  for (const attribute of attributes) {
    const value = element.getAttribute(attribute);
    if (value && LATIN_DIGITS.test(value)) {
      element.setAttribute(attribute, normalizeDigits(value));
    }
    LATIN_DIGITS.lastIndex = 0;
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (element.type !== "date" && element.type !== "datetime-local" && element.type !== "time") {
      const value = element.value;
      if (LATIN_DIGITS.test(value)) {
        const normalized = normalizeDigits(value);
        const start = element.selectionStart;
        element.value = normalized;
        if (start !== null) element.setSelectionRange(start, start);
      }
      LATIN_DIGITS.lastIndex = 0;
    }
  }
}

function normalizeTextNode(node: Text) {
  if (LATIN_DIGITS.test(node.nodeValue ?? "")) {
    node.nodeValue = normalizeDigits(node.nodeValue ?? "");
  }
  LATIN_DIGITS.lastIndex = 0;
}

function normalizeTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    normalizeTextNode(root as Text);
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;

  if (root instanceof Element) normalizeElement(root);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current: Node | null = walker.nextNode();
  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }
  for (const textNode of textNodes) normalizeTextNode(textNode);

  if (root instanceof Element) {
    root.querySelectorAll("[aria-label], [title], [placeholder], input, textarea").forEach(normalizeElement);
  }
}

export function LatinDigits() {
  useEffect(() => {
    normalizeTree(document.body);

    const observer = new MutationObserver((mutations) => {
      observer.disconnect();
      for (const mutation of mutations) {
        if (mutation.type === "characterData" && mutation.target.nodeType === Node.TEXT_NODE) {
          normalizeTextNode(mutation.target as Text);
        } else {
          mutation.addedNodes.forEach(normalizeTree);
          if (mutation.type === "attributes" && mutation.target instanceof Element) {
            normalizeElement(mutation.target);
          }
        }
      }
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["aria-label", "title", "placeholder"],
      });
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-label", "title", "placeholder"],
    });

    const handleInput = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
      if (["date", "datetime-local", "time"].includes(target.type)) return;
      const value = target.value;
      if (!LATIN_DIGITS.test(value)) {
        LATIN_DIGITS.lastIndex = 0;
        return;
      }
      LATIN_DIGITS.lastIndex = 0;
      const normalized = normalizeDigits(value);
      if (normalized !== value) {
        const cursor = target.selectionStart;
        target.value = normalized;
        if (cursor !== null) target.setSelectionRange(cursor, cursor);
      }
    };

    document.addEventListener("input", handleInput, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("input", handleInput, true);
    };
  }, []);

  return null;
}
